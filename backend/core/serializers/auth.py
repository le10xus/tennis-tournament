from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Добавляет role и is_staff в JWT-клеймы и тело ответа."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["is_staff"] = user.is_staff
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["role"] = self.user.role
        data["is_staff"] = self.user.is_staff
        data["username"] = self.user.username
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=4)
    role = serializers.ChoiceField(
        choices=User.Role.choices,
        default=User.Role.PLAYER,
        required=False,
    )

    class Meta:
        model = User
        fields = ("username", "password", "email", "first_name", "last_name", "role")
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
        }

    def validate_role(self, value: str) -> str:
        if value not in (User.Role.PLAYER, User.Role.ORGANIZER):
            raise serializers.ValidationError("Можно зарегистрироваться только как игрок или организатор.")
        return value

    def validate_username(self, value: str) -> str:
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Пользователь с таким логином уже существует.")
        return value

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
