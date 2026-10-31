from django.db import models
from django.core.exceptions import ValidationError

class InventoryCategory(models.Model):
    code = models.CharField(max_length=40, db_index=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="children",
    )
    context_id = models.CharField(max_length=80, default="default", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inv_categories"
        ordering = ("name", "id")
        unique_together = (("context_id", "code"),)

    def clean(self):
        super().clean()
        if self.parent_id:
            parent = self.parent
            while parent is not None:
                if parent.pk == self.pk:
                    raise ValidationError({"parent": "A category cannot contain itself."})
                parent = parent.parent

    def __str__(self):
        return f"{self.code} – {self.name}"
