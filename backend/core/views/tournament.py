from collections import defaultdict
from datetime import datetime, time, timedelta
from math import ceil, log2
import os
import random

from django.db import transaction
from django.db.models import Count, F, OuterRef, Q, Subquery, Sum
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.models import Match, Tournament, TournamentPhoto, TournamentRegistration
from core.permissions import RolePermission, TournamentRegistrationPermission
from core.serializers import (
    TournamentListSerializer,
    TournamentPhotoSerializer,
    TournamentPointsAwardSerializer,
    TournamentSerializer,
    TournamentRegistrationSerializer,
)
from core.serializers.match import MatchSerializer
from core.serializers.tournament import registration_eligibility_error
from core.services.age import age_check
from core.services.points import apply_awards, build_awards, revert_awards


def tournament_rating(player, kind):
    """Рейтинг игрока в контексте турнира: одиночный или парный разряд."""
    return (
        player.points_doubles
        if kind == Tournament.Kind.DOUBLES
        else player.points_singles
    )


def recalculate_seeds(tournament):
    """Посев 1–4 получают сильнейшие участники.

    В парном турнире рейтинг считается по паре: сумма парных очков обоих партнёров.
    """
    regs = list(
        TournamentRegistration.objects
        .filter(
            tournament=tournament,
            status=TournamentRegistration.Status.APPROVED,
        )
        .select_related("player")
    )

    if tournament.kind == Tournament.Kind.DOUBLES:
        grouped = defaultdict(list)
        for reg in regs:
            key = reg.pair_id if reg.pair_id is not None else f"single-{reg.pk}"
            grouped[key].append(reg)
        groups = list(grouped.values())
    else:
        groups = [[reg] for reg in regs]

    groups.sort(key=lambda group: (
        -sum(tournament_rating(reg.player, tournament.kind) for reg in group),
        min(reg.player.last_name for reg in group),
    ))

    changed = []
    for index, group in enumerate(groups, start=1):
        seed = index if index <= 4 else None
        for reg in group:
            if reg.seed != seed:
                reg.seed = seed
                changed.append(reg)
    if changed:
        TournamentRegistration.objects.bulk_update(changed, ["seed"])


class TournamentViewSet(ModelViewSet):
    permission_classes = [RolePermission]
    serializer_class = TournamentSerializer
    queryset = Tournament.objects.none()

    def get_serializer_class(self):
        if self.action == "list":
            return TournamentListSerializer
        return TournamentSerializer

    def get_queryset(self):
        qs = Tournament.objects.annotate(
            players_count=Count(
                "tournamentregistration",
                filter=Q(
                    tournamentregistration__status=TournamentRegistration.Status.APPROVED
                ),
            )
        )
        status_param = self.request.query_params.get("status")
        gender_type = self.request.query_params.get("gender_type")
        kind_param = self.request.query_params.get("kind")
        if status_param:
            qs = qs.filter(status=status_param)
        if gender_type:
            qs = qs.filter(gender_type=gender_type)
        if kind_param:
            qs = qs.filter(kind=kind_param)
        qs = qs.order_by("-start_date", "-id")
        if self.action == "retrieve":
            qs = qs.prefetch_related("photos", "points_awards__player")
        return qs

    @action(detail=True, methods=["post"], url_path="generate_bracket")
    def generate_bracket(self, request, pk=None):
        user = request.user
        if not (user.is_staff or getattr(user, "role", "player") == "organizer"):
            return Response({"detail": "Недостаточно прав."}, status=403)

        tournament = self.get_object()
        only_seeded = bool(request.data.get("only_seeded"))
        recalculate_seeds(tournament)
        regs = list(
            TournamentRegistration.objects
            .filter(
                tournament=tournament,
                status=TournamentRegistration.Status.APPROVED,
            )
            .select_related("player")
            .order_by(F("seed").asc(nulls_last=True), "registered_at")
        )

        if tournament.kind == Tournament.Kind.DOUBLES:
            pair_counts = defaultdict(int)
            for reg in regs:
                if reg.pair_id is not None:
                    pair_counts[reg.pair_id] += 1
            if sum(1 for count in pair_counts.values() if count >= 2) < 2:
                return Response(
                    {"detail": "Нужно минимум 2 пары. Назначьте номера пар игрокам."},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
        elif len(regs) < 2:
            return Response(
                {"detail": "Нужно минимум 2 игрока."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        Match.objects.filter(tournament=tournament).delete()

        already_created = False
        if tournament.format == Tournament.Format.DOUBLE_ELIM:
            result = self._generate_double_elim(tournament, regs, only_seeded)
            if isinstance(result, Response):
                return result
            matches = result
            already_created = True
        elif tournament.format == Tournament.Format.SINGLE_ELIM:
            participants = self._participants(tournament, regs)
            if len(participants) < 2:
                return Response({"detail": "Нужно минимум 2 участника."}, status=400)
            size = 2 ** ceil(log2(max(len(participants), 2)))
            matches = self._generate_main_with_third(
                tournament, participants, size, only_seeded
            )
            already_created = True
        elif tournament.kind == Tournament.Kind.DOUBLES:
            result = self._generate_doubles(tournament, regs)
            if isinstance(result, Response):
                return result
            matches = result
        else:
            players = [r.player for r in regs]
            if len(players) < 2:
                return Response({"detail": "Нужно минимум 2 игрока."}, status=400)
            matches = self._gen_round_robin(tournament, players)

        if not already_created:
            Match.objects.bulk_create(matches)
        qs = Match.objects.filter(tournament=tournament).select_related(
            "player1", "player2", "pair1_player2", "pair2_player2", "winner"
        )
        return Response(MatchSerializer(qs, many=True).data, status=http_status.HTTP_201_CREATED)

    DAY_END_MINUTES = 21 * 60

    SCHEDULE_ORDER = {
        (Match.Bracket.WINNERS, 1): 1,
        (Match.Bracket.CONSOLATION, 1): 2,
        (Match.Bracket.WINNERS, 2): 3,
        (Match.Bracket.CONSOLATION, 2): 4,
        (Match.Bracket.WINNERS, 3): 5,
        (Match.Bracket.WINNERS, 4): 6,
        (Match.Bracket.WINNERS, 5): 7,
        (Match.Bracket.THIRD_PLACE, 1): 8,
    }

    @staticmethod
    def _day_start_time(tournament, day_date):
        if day_date.weekday() == 5:
            return tournament.saturday_start_time or time(9, 0)
        if day_date.weekday() == 6:
            return tournament.sunday_start_time or time(9, 0)
        return time(9, 0)

    def _day_geometry(self, tournament, day_date):
        """Сколько матчей влезает в день, во сколько старт и по сколько минут."""
        start_time = self._day_start_time(tournament, day_date)
        duration = max(tournament.match_duration_minutes or 60, 15)
        courts = max(tournament.courts or 1, 1)
        start_minutes = start_time.hour * 60 + start_time.minute
        slots = max((self.DAY_END_MINUTES - start_minutes) // duration, 0)
        return {
            "start_time": start_time,
            "start_minutes": start_minutes,
            "duration": duration,
            "courts": courts,
            "slots": slots,
        }

    @staticmethod
    def _schedule_target(tournament, matches):
        """Первый незавершённый игровой день (или следующий после последнего)."""
        by_date = defaultdict(list)
        for match in matches:
            if match.scheduled_at:
                by_date[timezone.localtime(match.scheduled_at).date()].append(match)

        for day_date in sorted(by_date):
            if any(
                match.status not in (Match.Status.FINISHED, Match.Status.WALKOVER)
                for match in by_date[day_date]
            ):
                return day_date

        if by_date:
            return max(by_date) + timedelta(days=1)
        return tournament.start_date

    @staticmethod
    def _occupied_slots(tournament, matches, day_date, geometry):
        occupied = set()
        start_minutes = geometry["start_minutes"]
        duration = geometry["duration"]
        for match in matches:
            if not match.scheduled_at or not match.court:
                continue
            moment = timezone.localtime(match.scheduled_at)
            if moment.date() != day_date:
                continue
            slot = (moment.hour * 60 + moment.minute - start_minutes) // duration
            if slot < 0 or slot >= geometry["slots"]:
                continue
            occupied.add((slot, match.court))

        # в текущем дне прошедшие слоты уже не используем
        if day_date == timezone.localdate():
            now = timezone.localtime()
            elapsed = (now.hour * 60 + now.minute - start_minutes) // duration
            for slot in range(max(elapsed, 0)):
                for court in range(1, geometry["courts"] + 1):
                    occupied.add((slot, court))
        return occupied

    @action(detail=True, methods=["post"], url_path="generate_schedule")
    def generate_schedule(self, request, pk=None):
        """Раскладывает матчи по кортам — только на текущий игровой день.

        Следующий день не трогаем, пока не завершены матчи текущего. Готовыми
        считаются матчи, у которых известны обе стороны.
        """
        user = request.user
        if not (user.is_staff or getattr(user, "role", "player") == "organizer"):
            return Response({"detail": "Недостаточно прав."}, status=403)

        tournament = self.get_object()
        all_matches = list(Match.objects.filter(tournament=tournament))
        if not all_matches:
            return Response({"detail": "Нет матчей для расписания."}, status=400)

        reset = bool(request.data.get("reset"))
        day_date = self._schedule_target(tournament, all_matches)
        today = timezone.localdate()
        if day_date < today:
            # турнир идёт с опозданием — планируем на сегодня, а не в прошлое
            day_date = today

        # всё, что стояло на будущих днях, — преждевременно; reset очищает и текущий день
        cleared = []
        for match in all_matches:
            if not match.scheduled_at:
                continue
            if match.status in (Match.Status.FINISHED, Match.Status.WALKOVER):
                continue
            match_date = timezone.localtime(match.scheduled_at).date()
            if match_date > day_date or (reset and match_date >= day_date):
                match.scheduled_at = None
                match.court = None
                cleared.append(match)

        geometry = self._day_geometry(tournament, day_date)
        occupied = self._occupied_slots(tournament, all_matches, day_date, geometry)

        ready = [
            match
            for match in all_matches
            if not match.scheduled_at
            and match.status not in (Match.Status.FINISHED, Match.Status.WALKOVER)
            and match.player1_id
            and match.player2_id
        ]
        ready.sort(key=lambda match: (
            self.SCHEDULE_ORDER.get((match.bracket, match.round_number), 99),
            match.round_number,
            match.slot_index,
        ))

        tz = timezone.get_current_timezone()
        placed = []
        slots = geometry["slots"]
        courts = geometry["courts"]
        duration = geometry["duration"]
        for slot in range(slots):
            for court in range(1, courts + 1):
                if not ready:
                    break
                if (slot, court) in occupied:
                    continue
                match = ready.pop(0)
                start = (
                    datetime.combine(day_date, geometry["start_time"])
                    + timedelta(minutes=duration * slot)
                )
                match.scheduled_at = timezone.make_aware(start, tz)
                match.court = court
                placed.append(match)
            if not ready:
                break

        changed = {m.pk: m for m in cleared + placed}
        if changed:
            Match.objects.bulk_update(
                list(changed.values()), ["scheduled_at", "court"]
            )

        if placed:
            message = f"Расписание на {day_date:%d.%m} составлено: {len(placed)} матч(ей)."
        elif ready:
            message = (
                "На этот день больше нет свободных слотов — "
                "завершите матчи, чтобы открыть следующий день."
            )
        elif any(not m.scheduled_at for m in all_matches):
            message = (
                "Готовых матчей нет: ждём результаты предыдущих, "
                "чтобы определить участников."
            )
        else:
            message = "Все матчи уже стоят в расписании."

        if cleared:
            message += (
                f" Очищено матчей будущих дней: {len(cleared)} — "
                "их нужно составить заново после завершения текущего дня."
            )

        qs = Match.objects.filter(tournament=tournament).select_related(
            "player1", "player2", "pair1_player2", "pair2_player2", "winner"
        )
        return Response({
            "message": message,
            "day": day_date.isoformat(),
            "scheduled_count": len(placed),
            "remaining": len(ready),
            "cleared": len(cleared),
            "matches": MatchSerializer(qs, many=True).data,
        })

    @action(detail=True, methods=["get"], url_path="schedule_template")
    def schedule_template(self, request, pk=None):
        """Предварительный план на ближайшие дни — ничего не сохраняет."""
        if not self._can_edit_content(request.user):
            return Response({"detail": "Недостаточно прав."}, status=403)

        tournament = self.get_object()
        try:
            days_count = int(request.query_params.get("days", 3))
        except (TypeError, ValueError):
            days_count = 3
        days_count = min(max(days_count, 1), 7)

        all_matches = list(
            Match.objects
            .filter(tournament=tournament)
            .select_related("player1", "player2", "pair1_player2", "pair2_player2")
        )
        unplayed = [
            match for match in all_matches
            if match.status not in (Match.Status.FINISHED, Match.Status.WALKOVER)
        ]
        unplayed.sort(key=lambda match: (
            self.SCHEDULE_ORDER.get((match.bracket, match.round_number), 99),
            match.round_number,
            match.slot_index,
        ))

        day_date = self._schedule_target(tournament, all_matches)
        today = timezone.localdate()
        if day_date < today:
            day_date = today
        days = []
        queue = list(unplayed)
        for _ in range(days_count):
            geometry = self._day_geometry(tournament, day_date)
            occupied = set()
            if day_date == timezone.localdate():
                now = timezone.localtime()
                elapsed = (
                    now.hour * 60 + now.minute - geometry["start_minutes"]
                ) // geometry["duration"]
                for slot in range(max(elapsed, 0)):
                    for court in range(1, geometry["courts"] + 1):
                        occupied.add((slot, court))
            entries = []
            slots = geometry["slots"]
            courts = geometry["courts"]
            for slot in range(slots):
                for court in range(1, courts + 1):
                    if not queue:
                        break
                    if (slot, court) in occupied:
                        continue
                    match = queue.pop(0)
                    start_minutes = geometry["start_minutes"] + geometry["duration"] * slot
                    entries.append({
                        "id": match.id,
                        "time": f"{start_minutes // 60:02d}:{start_minutes % 60:02d}",
                        "court": court,
                        "round_number": match.round_number,
                        "bracket": match.bracket,
                        "group": match.group,
                        "player1": match.player1.last_name if match.player1 else "TBD",
                        "pair1_player2": (
                            match.pair1_player2.last_name if match.pair1_player2 else ""
                        ),
                        "player2": match.player2.last_name if match.player2 else "TBD",
                        "pair2_player2": (
                            match.pair2_player2.last_name if match.pair2_player2 else ""
                        ),
                    })
                if not queue:
                    break

            days.append({
                "date": day_date.isoformat(),
                "start": geometry["start_time"].strftime("%H:%M"),
                "capacity": slots * courts,
                "matches": entries,
            })
            day_date = day_date + timedelta(days=1)
            if not queue:
                break

        return Response({"target_date": days[0]["date"], "days": days})

    @staticmethod
    def _can_edit_content(user):
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or getattr(user, "role", "player") == "organizer")
        )

    MAX_PHOTO_SIZE = 10 * 1024 * 1024
    MAX_REGULATION_SIZE = 20 * 1024 * 1024
    REGULATION_CONTENT_TYPES = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    }

    @staticmethod
    def _upload_error(upload, allowed_types, max_size, kind):
        if upload.size > max_size:
            return f"Файл «{kind}» больше {max_size // (1024 * 1024)} МБ."
        content_type = (getattr(upload, "content_type", "") or "").lower()
        if allowed_types and content_type not in allowed_types:
            return f"Недопустимый формат файла «{kind}»."
        return None

    @action(
        detail=True,
        methods=["post"],
        url_path="photos",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_photo(self, request, pk=None):
        if not self._can_edit_content(request.user):
            return Response({"detail": "Недостаточно прав."}, status=403)
        tournament = self.get_object()
        image = request.FILES.get("image")
        if not image:
            return Response({"detail": "Не передан файл."}, status=400)
        if not (getattr(image, "content_type", "") or "").startswith("image/"):
            return Response({"detail": "Можно загружать только изображения."}, status=400)
        error = self._upload_error(image, set(), self.MAX_PHOTO_SIZE, "фото")
        if error:
            return Response({"detail": error}, status=400)
        photo = TournamentPhoto.objects.create(
            tournament=tournament,
            image=image,
            caption=(request.data.get("caption") or "")[:200],
            order=TournamentPhoto.objects.filter(tournament=tournament).count(),
        )
        return Response(TournamentPhotoSerializer(photo).data, status=201)

    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_id>\d+)")
    def delete_photo(self, request, pk=None, photo_id=None):
        if not self._can_edit_content(request.user):
            return Response({"detail": "Недостаточно прав."}, status=403)
        deleted, _ = TournamentPhoto.objects.filter(
            tournament_id=pk, pk=photo_id
        ).delete()
        if not deleted:
            return Response({"detail": "Фото не найдено."}, status=404)
        return Response(status=204)

    @action(
        detail=True,
        methods=["post"],
        url_path="regulation",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_regulation(self, request, pk=None):
        if not self._can_edit_content(request.user):
            return Response({"detail": "Недостаточно прав."}, status=403)
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "Не передан файл."}, status=400)
        if upload.size > self.MAX_REGULATION_SIZE:
            return Response(
                {
                    "detail": (
                        "Файл регламента больше "
                        f"{self.MAX_REGULATION_SIZE // (1024 * 1024)} МБ."
                    )
                },
                status=400,
            )
        extension = os.path.splitext(upload.name)[1].lower()
        if extension not in {".pdf", ".doc", ".docx", ".txt"}:
            return Response(
                {"detail": "Регламент должен быть PDF, DOC, DOCX или TXT."},
                status=400,
            )
        tournament = self.get_object()
        tournament.regulation.save(upload.name, upload)
        tournament.save(update_fields=["regulation"])
        return Response(self.get_serializer(tournament).data)

    @action(detail=True, methods=["post"], url_path="award_points")
    def award_points(self, request, pk=None):
        if not self._can_edit_content(request.user):
            return Response({"detail": "Недостаточно прав."}, status=403)

        tournament = self.get_object()
        if not tournament.points_category:
            return Response(
                {"detail": "У турнира не выбрана категория начисления очков."},
                status=400,
            )

        matches = list(
            Match.objects.filter(tournament=tournament).select_related(
                "player1", "pair1_player2", "player2", "pair2_player2", "winner"
            )
        )
        awards = build_awards(tournament, matches)
        if not awards:
            return Response(
                {"detail": "Нет завершённых матчей — некому начислять очки."},
                status=400,
            )

        created = apply_awards(tournament)
        tournament.points_awarded_at = timezone.now()
        tournament.save(update_fields=["points_awarded_at"])

        return Response(
            {
                "awards": TournamentPointsAwardSerializer(created, many=True).data,
                "points_category": tournament.points_category,
                "points_category_display": tournament.get_points_category_display(),
            }
        )

    def perform_destroy(self, instance):
        revert_awards(instance)
        instance.delete()

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        tournament = serializer.save()
        if (
            tournament.status == Tournament.Status.FINISHED
            and previous_status != Tournament.Status.FINISHED
            and tournament.points_category
            and not tournament.points_awards.exists()
            and self._all_matches_finished(tournament)
        ):
            if build_awards(tournament):
                apply_awards(tournament)
                tournament.points_awarded_at = timezone.now()
                tournament.save(update_fields=["points_awarded_at"])

    @staticmethod
    def _all_matches_finished(tournament):
        # пустые матчи (например, незаполненный матч за 3-е место) не учитываем
        matches = Match.objects.filter(
            tournament=tournament,
            player1__isnull=False,
            player2__isnull=False,
        )
        return matches.exists() and not matches.exclude(
            status__in=[Match.Status.FINISHED, Match.Status.WALKOVER]
        ).exists()

    def _generate_doubles(self, tournament, regs):
        grouped = defaultdict(list)
        for r in regs:
            if r.pair_id is not None:
                grouped[r.pair_id].append(r)

        # Build list of complete pairs sorted by min seed (nulls last)
        pairs = []
        for pair_id, pair_regs in sorted(grouped.items()):
            if len(pair_regs) < 2:
                continue
            seeds = [r.seed for r in pair_regs if r.seed is not None]
            pair_seed = min(seeds) if seeds else None
            pairs.append((pair_seed, pair_regs[0].player, pair_regs[1].player))

        pairs.sort(key=lambda x: (x[0] is None, x[0]))

        if len(pairs) < 2:
            return Response(
                {"detail": "Нужно минимум 2 пары. Назначьте номера пар игрокам."},
                status=400,
            )

        pair_list = [(p[1], p[2]) for p in pairs]

        if tournament.format == Tournament.Format.ROUND_ROBIN:
            return self._gen_round_robin_doubles(tournament, pair_list)
        return self._gen_single_elim_doubles(tournament, pair_list)

    def _gen_round_robin_doubles(self, tournament, pairs):
        working = list(pairs)
        if len(working) % 2 == 1:
            working.append(None)
        m = len(working)
        fixed = working[0]
        rotating = list(working[1:])
        matches = []
        for round_num in range(1, m):
            current = [fixed] + rotating
            for i in range(m // 2):
                pair_a = current[i]
                pair_b = current[m - 1 - i]
                if pair_a is not None and pair_b is not None:
                    matches.append(Match(
                        tournament=tournament,
                        gender_type=tournament.gender_type,
                        player1=pair_a[0], pair1_player2=pair_a[1],
                        player2=pair_b[0], pair2_player2=pair_b[1],
                        round_number=round_num,
                        status="scheduled",
                    ))
            rotating = [rotating[-1]] + rotating[:-1]
        return matches

    def _gen_single_elim_doubles(self, tournament, pairs):
        n = len(pairs)
        bracket_size = 2 ** ceil(log2(max(n, 2)))
        positions = self._bracket_order(bracket_size)
        matches = []
        for i in range(0, bracket_size, 2):
            pair_a = pairs[positions[i] - 1] if positions[i] <= n else None
            pair_b = pairs[positions[i + 1] - 1] if positions[i + 1] <= n else None
            if pair_a is None and pair_b is None:
                continue
            p1, p1p2 = (pair_a[0], pair_a[1]) if pair_a else (None, None)
            p2, p2p2 = (pair_b[0], pair_b[1]) if pair_b else (None, None)
            matches.append(Match(
                tournament=tournament,
                gender_type=tournament.gender_type,
                player1=p1, pair1_player2=p1p2,
                player2=p2, pair2_player2=p2p2,
                round_number=1,
                slot_index=i // 2,
                status="scheduled",
            ))
        return matches

    # ── Сетка с подвалом ──────────────────────────────────────────────────────

    @staticmethod
    def _participants(tournament, regs):
        """Участники сетки: для парного турнира — пары (player, partner)."""
        if tournament.kind != Tournament.Kind.DOUBLES:
            return [(reg.player, None) for reg in regs]

        grouped = defaultdict(list)
        for reg in regs:
            if reg.pair_id is not None:
                grouped[reg.pair_id].append(reg)
        pairs = []
        for pair_regs in grouped.values():
            if len(pair_regs) < 2:
                continue
            seeds = [r.seed for r in pair_regs if r.seed is not None]
            pairs.append((
                min(seeds) if seeds else 999,
                pair_regs[0].player,
                pair_regs[1].player,
            ))
        pairs.sort(key=lambda item: item[0])
        return [(item[1], item[2]) for item in pairs]

    def _generate_double_elim(self, tournament, regs, only_seeded=False):
        """Сетка с подвалом на 16 участников (28 матчей):

        1/8 — 8 матчей;
        1/4 основной — 4 матча;
        1/4 подвала (9–16) — 4 матча, проигравшие в 1/8;
        1/4 подвала-2 (5–8) — 4 матча: победители подвала + проигравшие 1/4 основной;
        1/4 основной-2 — 4 матча: победители 1/4 основной + победители подвала-2;
        1/2 — 2, финал — 1, матч за 3-е место — 1.
        """
        participants = self._participants(tournament, regs)

        count = len(participants)
        if count < 2:
            return Response({"detail": "Нужно минимум 2 участника."}, status=400)

        size = 2 ** ceil(log2(max(count, 4)))
        if size != 16:
            return self._generate_main_with_third(tournament, participants, size, only_seeded)

        slots = self._seed_slots(participants, size, only_seeded)

        def new_match(bracket, round_no, slot, group=""):
            return Match(
                tournament=tournament,
                bracket=bracket,
                group=group,
                gender_type=tournament.gender_type,
                round_number=round_no,
                slot_index=slot,
                status=Match.Status.SCHEDULED,
            )

        round_1_8 = [new_match(Match.Bracket.WINNERS, 1, i) for i in range(8)]
        main_qf_1 = [new_match(Match.Bracket.WINNERS, 2, i) for i in range(4)]
        base_qf_1 = [
            new_match(Match.Bracket.CONSOLATION, 1, i, Match.Group.PLACES_9_16)
            for i in range(4)
        ]
        base_qf_2 = [
            new_match(Match.Bracket.CONSOLATION, 2, i, Match.Group.PLACES_5_8)
            for i in range(4)
        ]
        main_qf_2 = [new_match(Match.Bracket.WINNERS, 3, i) for i in range(4)]
        semis = [new_match(Match.Bracket.WINNERS, 4, i) for i in range(2)]
        final = new_match(Match.Bracket.WINNERS, 5, 0)
        third_place = new_match(Match.Bracket.THIRD_PLACE, 1, 0)

        for i, match in enumerate(round_1_8):
            first = slots[2 * i] if 2 * i < size else None
            second = slots[2 * i + 1] if 2 * i + 1 < size else None
            if first:
                match.player1, match.pair1_player2 = first
            if second:
                match.player2, match.pair2_player2 = second

        all_matches = (
            round_1_8 + main_qf_1 + base_qf_1 + base_qf_2 + main_qf_2
            + semis + [final, third_place]
        )
        Match.objects.bulk_create(all_matches)

        for i, match in enumerate(round_1_8):
            match.next_match = main_qf_1[i // 2]
            match.next_slot = i % 2 + 1
            match.loser_next_match = base_qf_1[i // 2]
            match.loser_next_slot = i % 2 + 1

        for i, match in enumerate(base_qf_1):
            match.next_match = base_qf_2[i]
            match.next_slot = 1

        for i, match in enumerate(main_qf_1):
            match.next_match = main_qf_2[i]
            match.next_slot = 1
            match.loser_next_match = base_qf_2[i]
            match.loser_next_slot = 2

        for i, match in enumerate(base_qf_2):
            match.next_match = main_qf_2[i]
            match.next_slot = 2

        for i, match in enumerate(main_qf_2):
            match.next_match = semis[i // 2]
            match.next_slot = i % 2 + 1

        for i, match in enumerate(semis):
            match.next_match = final
            match.next_slot = i + 1
            match.loser_next_match = third_place
            match.loser_next_slot = i + 1

        Match.objects.bulk_update(
            all_matches,
            ["next_match", "next_slot", "loser_next_match", "loser_next_slot"],
        )
        return all_matches

    @staticmethod
    def _seed_slots(participants, size, only_seeded=False):
        """Посев: 1 — вверх, 2 — вниз, 3 — вниз первой половины, 4 — вверх второй.

        Остальные участники распределяются по свободным слотам случайно.
        При only_seeded остальные слоты остаются пустыми — их заполняет админ.
        Если участников меньше сетки, пустые слоты (bye) отдаются сеяным.
        """
        quarter = size // 4
        positions = [0, size - 1, quarter * 2 - 1, quarter * 2]
        slots = [None] * size
        seed_used = set()
        bye_slots = set()
        byes = max(0, size - len(participants))
        for seed_index, participant in enumerate(participants[:4]):
            index = positions[seed_index]
            if index in seed_used:
                continue
            slots[index] = participant
            seed_used.add(index)
            if seed_index < byes:
                bye_slots.add(index ^ 1)
            bye_slots.discard(index)

        if only_seeded:
            return slots

        remaining = list(participants[4:])
        random.shuffle(remaining)
        free = [
            index
            for index in range(size)
            if index not in seed_used and index not in bye_slots
        ]
        for index, participant in zip(free, remaining):
            slots[index] = participant
        return slots

    def _generate_main_with_third(self, tournament, participants, size, only_seeded=False):
        """Запасная схема для числа участников, отличного от 16: олимпийка + 3-е место."""

        def new_match(bracket, round_no, slot):
            return Match(
                tournament=tournament,
                bracket=bracket,
                gender_type=tournament.gender_type,
                round_number=round_no,
                slot_index=slot,
                status=Match.Status.SCHEDULED,
            )

        rounds = []
        matches_in_round = size // 2
        round_no = 1
        while matches_in_round >= 1:
            rounds.append([
                new_match(Match.Bracket.WINNERS, round_no, i)
                for i in range(matches_in_round)
            ])
            matches_in_round //= 2
            round_no += 1

        slots = self._seed_slots(participants, size, only_seeded)
        for i, match in enumerate(rounds[0]):
            if 2 * i < len(slots) and slots[2 * i]:
                match.player1, match.pair1_player2 = slots[2 * i]
            if 2 * i + 1 < len(slots) and slots[2 * i + 1]:
                match.player2, match.pair2_player2 = slots[2 * i + 1]

        third_place = new_match(Match.Bracket.THIRD_PLACE, 1, 0)

        all_matches = [match for rnd in rounds for match in rnd] + [third_place]
        Match.objects.bulk_create(all_matches)

        for index, round_matches in enumerate(rounds):
            for i, match in enumerate(round_matches):
                if index + 1 < len(rounds):
                    match.next_match = rounds[index + 1][i // 2]
                    match.next_slot = i % 2 + 1
                if index == len(rounds) - 2:
                    match.loser_next_match = third_place
                    match.loser_next_slot = i + 1

        Match.objects.bulk_update(
            all_matches,
            ["next_match", "next_slot", "loser_next_match", "loser_next_slot"],
        )

        self._pass_byes(rounds, enabled=not only_seeded)
        return all_matches

    @staticmethod
    def _pass_byes(rounds, enabled=True):
        """Пустой слот проходит дальше автоматически (bye)."""
        if not enabled:
            return
        changed = []
        for round_matches in rounds:
            for match in round_matches:
                if match.winner_id:
                    continue
                has_first = bool(match.player1_id or match.pair1_player2_id)
                has_second = bool(match.player2_id or match.pair2_player2_id)
                if has_first == has_second:
                    continue

                if has_first:
                    player, partner = match.player1, match.pair1_player2
                    slot = match.next_slot
                    target = match.next_match
                else:
                    player, partner = match.player2, match.pair2_player2
                    slot = match.next_slot
                    target = match.next_match

                match.winner = player
                match.status = Match.Status.WALKOVER
                match.score = ""
                changed.append(match)

                if not target:
                    continue
                if slot == 1:
                    target.player1, target.pair1_player2 = player, partner
                elif slot == 2:
                    target.player2, target.pair2_player2 = player, partner
                changed.append(target)

        if not changed:
            return

        Match.objects.bulk_update(
            list({m.pk: m for m in changed}.values()),
            ["winner", "status", "score", "player1", "pair1_player2", "player2", "pair2_player2"],
        )

    # ── Singles ────────────────────────────────────────────────────────────────

    def _gen_round_robin(self, tournament, players):
        working = list(players)
        if len(working) % 2 == 1:
            working.append(None)
        m = len(working)
        fixed = working[0]
        rotating = list(working[1:])
        matches = []
        for round_num in range(1, m):
            current = [fixed] + rotating
            for i in range(m // 2):
                p1 = current[i]
                p2 = current[m - 1 - i]
                if p1 is not None and p2 is not None:
                    matches.append(Match(
                        tournament=tournament,
                        gender_type=tournament.gender_type,
                        player1=p1, player2=p2,
                        round_number=round_num,
                        status="scheduled",
                    ))
            rotating = [rotating[-1]] + rotating[:-1]
        return matches

    @staticmethod
    def _bracket_order(size):
        if size == 2:
            return [1, 2]
        half = TournamentViewSet._bracket_order(size // 2)
        result = []
        for p in half:
            result.append(p)
            result.append(size + 1 - p)
        return result


class TournamentRegistrationViewSet(ModelViewSet):
    permission_classes = [TournamentRegistrationPermission]
    serializer_class = TournamentRegistrationSerializer
    queryset = TournamentRegistration.objects.none()

    def get_queryset(self):
        qs = TournamentRegistration.objects.select_related("player", "tournament")
        user = self.request.user
        if not user.is_authenticated:
            qs = qs.filter(status=TournamentRegistration.Status.APPROVED)
        elif not user.is_staff and getattr(user, "role", "player") == "player":
            visible = Q(status=TournamentRegistration.Status.APPROVED)
            if user.player_id:
                visible |= Q(player_id=user.player_id)
            qs = qs.filter(visible)

        tournament = None
        tournament_id = self.request.query_params.get("tournament")
        player_id = self.request.query_params.get("player")
        status_param = self.request.query_params.get("status")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
            tournament = Tournament.objects.filter(pk=tournament_id).first()
        if player_id:
            qs = qs.filter(player_id=player_id)
        if status_param:
            qs = qs.filter(status=status_param)

        if tournament is not None and tournament.kind == Tournament.Kind.DOUBLES:
            # в паре рейтинг общий: сумма парных очков обоих партнёров
            pair_rating = (
                TournamentRegistration.objects
                .filter(
                    tournament=OuterRef("tournament_id"),
                    pair_id=OuterRef("pair_id"),
                )
                .values("pair_id")
                .annotate(total=Sum("player__points_doubles"))
                .values("total")
            )
            qs = qs.annotate(pair_rating=Subquery(pair_rating)).order_by(
                F("pair_rating").desc(nulls_last=True),
                F("seed").asc(nulls_last=True),
                "pair_id",
                "-player__points_doubles",
            )
        else:
            qs = qs.order_by("-player__points_singles", "registered_at")

        return qs

    def perform_create(self, serializer):
        registration = serializer.save()
        recalculate_seeds(registration.tournament)

    def perform_destroy(self, instance):
        """Удаляет заявку; для парного турнира — всю пару целиком."""
        tournament = instance.tournament
        if instance.pair_id is not None:
            TournamentRegistration.objects.filter(
                tournament_id=instance.tournament_id,
                pair_id=instance.pair_id,
            ).delete()
        else:
            instance.delete()
        recalculate_seeds(tournament)

    def _approve(self, registration, wildcard=False, actor_is_admin=True):
        """Подтверждает заявку; для парного турнира — всю пару целиком."""
        with transaction.atomic():
            tournament = (
                Tournament.objects
                .select_for_update()
                .get(pk=registration.tournament_id)
            )
            registration = (
                TournamentRegistration.objects
                .select_for_update()
                .select_related("player", "tournament")
                .get(pk=registration.pk)
            )

            if registration.pair_id is not None:
                pending = list(
                    TournamentRegistration.objects
                    .select_for_update()
                    .select_related("player")
                    .filter(
                        tournament=tournament,
                        pair_id=registration.pair_id,
                        status=TournamentRegistration.Status.PENDING,
                    )
                )
            elif registration.status != TournamentRegistration.Status.APPROVED:
                pending = [registration]
            else:
                pending = []

            if not pending:
                return Response(
                    self.get_serializer(registration).data,
                    status=http_status.HTTP_200_OK,
                )

            for reg in pending:
                eligibility_error = registration_eligibility_error(
                    tournament, reg.player, check_status=False
                )
                if eligibility_error:
                    _, message = eligibility_error
                    return Response(
                        {"detail": message},
                        status=http_status.HTTP_400_BAD_REQUEST,
                    )

            if registration.pair_id is not None:
                pair_regs = (
                    TournamentRegistration.objects
                    .filter(tournament=tournament, pair_id=registration.pair_id)
                    .select_related("player")
                )
                age_players = [reg.player for reg in pair_regs]
            else:
                age_players = [reg.player for reg in pending]

            age_ok, age_message = age_check(tournament, age_players)
            if not age_ok and not wildcard:
                hint = (
                    " Подтвердите заявку с WC."
                    if actor_is_admin
                    else " Организатор может допустить вас с WC."
                )
                return Response(
                    {"detail": age_message + hint},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )

            approved_count = TournamentRegistration.objects.filter(
                tournament=tournament,
                status=TournamentRegistration.Status.APPROVED,
            ).count()
            if approved_count + len(pending) > tournament.max_players:
                return Response(
                    {"detail": "В турнире нет свободных мест."},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )

            for reg in pending:
                reg.status = TournamentRegistration.Status.APPROVED
                reg.invited_by = None
                reg.wildcard = bool(wildcard) or reg.wildcard
                reg.save(update_fields=["status", "invited_by", "wildcard"])

            registration.refresh_from_db()
            recalculate_seeds(tournament)

        return Response(
            self.get_serializer(registration).data,
            status=http_status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._approve(
            self.get_object(), wildcard=bool(request.data.get("wildcard"))
        )

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Игрок подтверждает приглашение в пару — пара уходит в approved."""
        registration = self.get_object()
        user = request.user
        is_admin = user.is_staff or getattr(user, "role", "player") == "organizer"
        if not is_admin:
            if not user.player_id or user.player_id != registration.player_id:
                return Response(
                    {"detail": "Подтвердить участие может только сам игрок."},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
            if registration.invited_by_id is None:
                return Response(
                    {"detail": "Подтвердить можно только приглашение в пару."},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
        return self._approve(registration, actor_is_admin=is_admin)
