from rest_framework import serializers

from core.models import Player


class PlayerSerializer(serializers.ModelSerializer):
    gender_display = serializers.CharField(source="get_gender_display", read_only=True)
    rating_type_display = serializers.CharField(source="get_rating_type_display", read_only=True)

    class Meta:
        model = Player
        fields = [
            "id", "first_name", "last_name", "email", "phone", "birth_date",
            "birth_year", "city",
            "gender", "gender_display",
            "rating", "rating_type", "rating_type_display",
            "ntrp_singles", "ntrp_doubles", "points_singles", "points_doubles",
            "is_ftvo",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
