from django.db import models

class Brand(models.Model):
    code = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    country = models.CharField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_brands"
        ordering = ("name",)

    def __str__(self):
        return f"{self.name} ({self.code})"

