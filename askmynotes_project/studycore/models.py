from django.db import models
import os

class Subject(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Note(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='notes')
    file = models.FileField(upload_to='notes/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.subject.name} - {self.filename}"

    @property
    def filename(self):
        return os.path.basename(self.file.name)

class ChatMessage(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='messages')
    query = models.TextField()
    response = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Q: {self.query[:30]}..."
