"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-11-06 10:20:38.421870
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from geoalchemy2 import Geography

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table('categories',
    sa.Column('category_id', sa.Integer(), nullable=False),
    sa.Column('category_name', sa.String(length=80), nullable=False),
    sa.Column('slug', sa.String(length=80), nullable=False),
    sa.PrimaryKeyConstraint('category_id'),
    sa.UniqueConstraint('category_name'),
    sa.UniqueConstraint('slug')
    )
    op.create_geospatial_table('locations',
    sa.Column('location_id', sa.Integer(), nullable=False),
    sa.Column('province', sa.String(length=80), nullable=False),
    sa.Column('municipality', sa.String(length=120), nullable=False),
    sa.Column('suburb', sa.String(length=120), nullable=True),
    sa.Column('latitude', sa.Float(), nullable=False),
    sa.Column('longitude', sa.Float(), nullable=False),
    sa.Column('geom', Geography(geometry_type='POINT', srid=4326, spatial_index=False, from_text='ST_GeogFromText', name='geography'), nullable=True),
    sa.PrimaryKeyConstraint('location_id')
    )
    op.create_geospatial_index('idx_locations_geom', 'locations', ['geom'], unique=False, postgresql_using='gist', postgresql_ops={})
    op.create_index(op.f('ix_locations_municipality'), 'locations', ['municipality'], unique=False)
    op.create_index(op.f('ix_locations_province'), 'locations', ['province'], unique=False)
    op.create_table('users',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('resident', 'admin', name='userrole'), nullable=False),
    sa.Column('province', sa.String(length=80), nullable=True),
    sa.Column('municipality', sa.String(length=120), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('incidents',
    sa.Column('incident_id', sa.Integer(), nullable=False),
    sa.Column('reference', sa.String(length=32), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('location_id', sa.Integer(), nullable=False),
    sa.Column('category_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=140), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('status', sa.Enum('submitted', 'under_review', 'verified', 'assigned', 'in_progress', 'resolved', 'duplicate', 'rejected', name='incidentstatus'), nullable=False),
    sa.Column('priority', sa.Enum('low', 'medium', 'high', 'critical', name='priority'), nullable=False),
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('assigned_to', sa.Integer(), nullable=True),
    sa.Column('duplicate_of', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['assigned_to'], ['users.user_id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['category_id'], ['categories.category_id'], ),
    sa.ForeignKeyConstraint(['duplicate_of'], ['incidents.incident_id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['location_id'], ['locations.location_id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('incident_id')
    )
    op.create_index(op.f('ix_incidents_category_id'), 'incidents', ['category_id'], unique=False)
    op.create_index(op.f('ix_incidents_created_at'), 'incidents', ['created_at'], unique=False)
    op.create_index(op.f('ix_incidents_reference'), 'incidents', ['reference'], unique=True)
    op.create_index(op.f('ix_incidents_status'), 'incidents', ['status'], unique=False)
    op.create_index(op.f('ix_incidents_user_id'), 'incidents', ['user_id'], unique=False)
    op.create_table('attachments',
    sa.Column('attachment_id', sa.Integer(), nullable=False),
    sa.Column('incident_id', sa.Integer(), nullable=False),
    sa.Column('file_url', sa.String(length=255), nullable=False),
    sa.Column('content_type', sa.String(length=50), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['incident_id'], ['incidents.incident_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('attachment_id')
    )
    op.create_index(op.f('ix_attachments_incident_id'), 'attachments', ['incident_id'], unique=False)
    op.create_table('confirmations',
    sa.Column('confirmation_id', sa.Integer(), nullable=False),
    sa.Column('incident_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('confirmed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['incident_id'], ['incidents.incident_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('confirmation_id'),
    sa.UniqueConstraint('incident_id', 'user_id', name='uq_confirmation_user_incident')
    )
    op.create_index(op.f('ix_confirmations_incident_id'), 'confirmations', ['incident_id'], unique=False)
    op.create_table('incident_updates',
    sa.Column('update_id', sa.Integer(), nullable=False),
    sa.Column('incident_id', sa.Integer(), nullable=False),
    sa.Column('updated_by', sa.Integer(), nullable=True),
    sa.Column('previous_status', sa.Enum('submitted', 'under_review', 'verified', 'assigned', 'in_progress', 'resolved', 'duplicate', 'rejected', name='incidentstatus'), nullable=True),
    sa.Column('status', sa.Enum('submitted', 'under_review', 'verified', 'assigned', 'in_progress', 'resolved', 'duplicate', 'rejected', name='incidentstatus'), nullable=False),
    sa.Column('comments', sa.Text(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['incident_id'], ['incidents.incident_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['updated_by'], ['users.user_id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('update_id')
    )
    op.create_index(op.f('ix_incident_updates_incident_id'), 'incident_updates', ['incident_id'], unique=False)
    op.create_table('notifications',
    sa.Column('notification_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('incident_id', sa.Integer(), nullable=True),
    sa.Column('message', sa.String(length=500), nullable=False),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['incident_id'], ['incidents.incident_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('notification_id')
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_incident_updates_incident_id'), table_name='incident_updates')
    op.drop_table('incident_updates')
    op.drop_index(op.f('ix_confirmations_incident_id'), table_name='confirmations')
    op.drop_table('confirmations')
    op.drop_index(op.f('ix_attachments_incident_id'), table_name='attachments')
    op.drop_table('attachments')
    op.drop_index(op.f('ix_incidents_user_id'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_status'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_reference'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_created_at'), table_name='incidents')
    op.drop_index(op.f('ix_incidents_category_id'), table_name='incidents')
    op.drop_table('incidents')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_locations_province'), table_name='locations')
    op.drop_index(op.f('ix_locations_municipality'), table_name='locations')
    op.drop_geospatial_index('idx_locations_geom', table_name='locations', postgresql_using='gist', column_name='geom')
    op.drop_geospatial_table('locations')
    op.drop_table('categories')
    for enum_name in ('incidentstatus', 'priority', 'userrole'):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
