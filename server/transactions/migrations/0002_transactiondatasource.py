from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('transactions', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TransactionDataSource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, unique=True)),
                ('source_type', models.CharField(choices=[('CORE_BANKING', 'Core Banking API'), ('API', 'Generic API'), ('FILE', 'File Upload'), ('MANUAL', 'Manual Entry')], default='API', max_length=20)),
                ('base_url', models.URLField(blank=True)),
                ('auth_type', models.CharField(choices=[('NONE', 'No Auth'), ('API_KEY', 'API Key'), ('BASIC', 'Basic Auth'), ('BEARER', 'Bearer Token')], default='NONE', max_length=20)),
                ('api_key', models.CharField(blank=True, max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('auto_monitor', models.BooleanField(default=True)),
                ('poll_interval_seconds', models.PositiveIntegerField(default=60)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Transaction Data Source',
                'verbose_name_plural': 'Transaction Data Sources',
                'db_table': 'transaction_data_sources',
                'ordering': ['name'],
            },
        ),
    ]
