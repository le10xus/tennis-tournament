from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, min_length=4
    )
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "password",
            "email", "first_name", "last_name",
            "role", "role_display",
            "is_staff", "is_active",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
        }

    def validate_password(self, value: str) -> str:
        if value:
            validate_password(value)
        return value

    def validate_username(self, value: str) -> str:
        value = value.strip()
        qs = User.objects.filter(username__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Пользователь с таким логином уже существует.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        user.set_password(password or User.objects.make_random_password())
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ProfileSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, min_length=4
    )
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    player_gender = serializers.CharField(source="player.gender", read_only=True)
    player_rating = serializers.IntegerField(source="player.rating", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "password",
            "first_name", "last_name",
            "role", "role_display", "is_staff",
            "player_id", "player_gender", "player_rating",
        ]
        read_only_fields = [
            "id", "username", "role", "role_display", "is_staff",
            "player_id", "player_gender", "player_rating",
        ]
        extra_kwargs = {
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
        }

    def validate_password(self, value: str) -> str:
        if value:
            validate_password(value)
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        if instance.player_id:
            player = instance.player
            updated_fields = []
            if player.first_name != instance.first_name:
                player.first_name = instance.first_name
                updated_fields.append("first_name")
            if player.last_name != instance.last_name:
                player.last_name = instance.last_name
                updated_fields.append("last_name")
            if updated_fields:
                player.save(update_fields=updated_fields)

        return instance
