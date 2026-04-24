from django.db import models


class GenderType(models.TextChoices):
    MALE = "male", "Мужской"
    FEMALE = "female", "Женский"
    MIXED = "mixed", "Микст"
