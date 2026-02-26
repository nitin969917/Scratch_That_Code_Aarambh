from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('subject/<int:subject_id>/', views.subject_detail, name='subject_detail'),
    path('subject/<int:subject_id>/upload/', views.upload_note, name='upload_note'),
    path('subject/<int:subject_id>/chat/', views.subject_chat, name='subject_chat'),
    path('subject/<int:subject_id>/chat/history/', views.subject_chat_history, name='subject_chat_history'),
    path('subject/<int:subject_id>/study/', views.study_mode, name='study_mode'),
    path('subject/<int:subject_id>/generate-quiz/', views.generate_quiz, name='generate_quiz'),
    
    # New JSON API Endpoints
    path('api/subjects/', views.api_subject_list, name='api_subject_list'),
    path('api/subjects/create/', views.api_create_subject, name='api_create_subject'),
    path('api/subjects/<int:subject_id>/delete/', views.api_delete_subject, name='api_delete_subject'),
    path('api/subjects/<int:subject_id>/notes/', views.api_subject_notes, name='api_subject_notes'),
    path('api/subjects/<int:subject_id>/upload/', views.api_upload_note, name='api_upload_note'),
    path('api/notes/<int:note_id>/delete/', views.api_delete_note, name='api_delete_note'),
    
    # Catch-all for React Router (if used) or unknown frontend paths
    re_path(r'^(?!media/|static/).*$', views.dashboard),
]
