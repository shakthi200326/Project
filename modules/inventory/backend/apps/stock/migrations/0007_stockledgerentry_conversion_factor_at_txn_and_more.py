from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stock', '0006_stockintransit'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockledgerentry',
            name='conversion_factor_at_txn',
            field=models.DecimalField(decimal_places=6, default=Decimal('1.000000'), max_digits=14),
        ),
        migrations.AddField(
            model_name='stockledgerentry',
            name='transaction_uom',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]
