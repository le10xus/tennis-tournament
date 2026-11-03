from django.db import models


class Player(models.Model):
    class RatingType(models.TextChoices):
        ELO = "elo", "ELO"
        MANUAL = "manual", "Ручной"

    class Gender(models.TextChoices):
        MALE = "male", "Мужской"
        FEMALE = "female", "Женский"

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    birth_year = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="Год рождения")
    gender = models.CharField(max_length=10, choices=Gender.choices, default=Gender.MALE)
    city = models.CharField(max_length=100, blank=True, verbose_name="Город")
    rating = models.IntegerField(default=1000)
    rating_type = models.CharField(max_length=10, choices=RatingType.choices, default=RatingType.ELO)
    ntrp_singles = models.CharField(max_length=8, blank=True, verbose_name="NTRP (одиночный)")
    ntrp_doubles = models.CharField(max_length=8, blank=True, verbose_name="NTRP (парный)")
    points_singles = models.PositiveIntegerField(default=0, verbose_name="Очки (одиночный)")
    points_doubles = models.PositiveIntegerField(default=0, verbose_name="Очки (парный)")
    is_ftvo = models.BooleanField(default=False, verbose_name="ФТВО")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.rating})"

    class Meta:
        ordering = ["-rating"]
