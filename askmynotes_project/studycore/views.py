import json
import os
import threading
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from .models import Subject, Note, ChatMessage

# Create your views here.
def dashboard(request):
    return render(request, 'index.html')

# --- Auth API Endpoints ---
@csrf_exempt
def api_register(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return JsonResponse({'error': 'Username and password required'}, status=400)
            
        if User.objects.filter(username=username).exists():
            return JsonResponse({'error': 'Username already exists'}, status=400)
            
        user = User.objects.create_user(username=username, password=password)
        login(request, user)
        return JsonResponse({'message': 'Registration successful', 'user': {'username': user.username}})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_login(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return JsonResponse({'message': 'Login successful', 'user': {'username': user.username}})
        else:
            return JsonResponse({'error': 'Invalid credentials'}, status=401)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def api_logout(request):
    if request.method == 'POST':
        logout(request)
        return JsonResponse({'message': 'Logged out successfully'})
    return JsonResponse({'error': 'Invalid method'}, status=405)

def api_check_auth(request):
    if request.user.is_authenticated:
        return JsonResponse({'authenticated': True, 'user': {'username': request.user.username}})
    return JsonResponse({'authenticated': False}, status=401)


# --- Core API Endpoints ---
@login_required(login_url='/')
def api_subject_list(request):
    # Only return subjects belonging to the logged-in user
    subjects = Subject.objects.filter(user=request.user).order_by('-created_at')
    data = [{
        'id': s.id,
        'name': s.name,
        'created_at': s.created_at.isoformat(),
        'note_count': s.notes.count()
    } for s in subjects]
    return JsonResponse({'subjects': data})

@csrf_exempt
def api_create_subject(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request'}, status=400)
    
    try:
        data = json.loads(request.body)
        name = data.get('name')
    except:
        name = request.POST.get('name')
        
    if Subject.objects.filter(user=request.user).count() >= 3:
        return JsonResponse({'error': 'You can only create up to 3 subjects.'}, status=400)
    
    if not name:
        return JsonResponse({'error': 'Subject name is required.'}, status=400)
        
    subject = Subject.objects.create(name=name, user=request.user)
    return JsonResponse({
        'id': subject.id,
        'name': subject.name,
        'message': 'Subject created successfully'
    })

@csrf_exempt
def api_delete_subject(request, subject_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method != 'DELETE' and request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    # Ensure the user owns this subject
    subject = get_object_or_404(Subject, id=subject_id, user=request.user)
    
    # Clean up physical files for all notes in this subject
    for note in subject.notes.all():
        if note.file and os.path.isfile(note.file.path):
            try:
                os.remove(note.file.path)
            except Exception as e:
                print(f"Error deleting file {note.file.path}: {e}")
                
    # Clean up FAISS index folder
    from django.conf import settings
    import shutil
    faiss_dir = os.path.join(settings.BASE_DIR, 'faiss_indices', f"subject_{subject.id}")
    if os.path.exists(faiss_dir):
        try:
            shutil.rmtree(faiss_dir)
        except Exception as e:
            print(f"Error deleting FAISS dir {faiss_dir}: {e}")

    subject.delete()
    return JsonResponse({'message': 'Subject deleted successfully'})

def api_subject_notes(request, subject_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    # Ensure the user owns this subject
    subject = get_object_or_404(Subject, id=subject_id, user=request.user)
    notes = subject.notes.all().order_by('-uploaded_at')

    data = [{
        'id': n.id,
        'filename': n.filename,
        'uploaded_at': n.uploaded_at.isoformat(),
        'file_url': n.file.url
    } for n in notes]
    return JsonResponse({
        'subject_name': subject.name,
        'notes': data
    })

@csrf_exempt
def api_upload_note(request, subject_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
        
    # Ensure the user owns this subject
    subject = get_object_or_404(Subject, id=subject_id, user=request.user)
    if request.method == 'POST' and request.FILES.get('file'):
        file = request.FILES['file']
        note = Note.objects.create(subject=subject, file=file)
        
        t = threading.Thread(target=_process_note_in_background, args=(note, subject.id))
        t.start()
        
        return JsonResponse({
            'id': note.id,
            'filename': note.filename,
            'message': 'Note uploaded and processing started'
        })
    return JsonResponse({'error': 'No file provided'}, status=400)

@csrf_exempt
def api_delete_note(request, note_id):
    if request.method != 'DELETE' and request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=405)
    
    note = get_object_or_404(Note, id=note_id)
    # Optional: Logic to remove from FAISS index if needed, 
    # but for now we'll just delete the DB entry and file.
    note.delete()
    return JsonResponse({'message': 'Note deleted successfully'})

def subject_detail(request, subject_id):
    return render(request, 'index.html')

def _process_note_in_background(note, subject_id):
    try:
        from .rag_engine import process_and_embed_file
        print(f"DEBUG: Starting background processing for {note.filename} (Subject: {subject_id})")
        success = process_and_embed_file(note.file.path, subject_id, note.filename)
        if success:
            print(f"DEBUG: Successfully indexed {note.filename}")
        else:
            print(f"ERROR: Failed to process {note.filename} (Empty text or extraction error)")
    except Exception as e:
        import traceback
        print(f"CRITICAL ERROR in background processing for {note.filename}: {str(e)}")
        traceback.print_exc()
        
def upload_note(request, subject_id):
    subject = get_object_or_404(Subject, id=subject_id)
    if request.method == 'POST' and request.FILES.get('file'):
        file = request.FILES['file']
        note = Note.objects.create(subject=subject, file=file)
        
        # Process file in background to not block UI
        t = threading.Thread(target=_process_note_in_background, args=(note, subject.id))
        t.start()
        
        messages.success(request, "Note uploaded! It is being processed and will be ready for chat shortly.")
        return redirect('subject_detail', subject_id=subject.id)
        
    return redirect('subject_detail', subject_id=subject.id)

def subject_chat_history(request, subject_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    # Ensure the user owns this subject
    subject = get_object_or_404(Subject, id=subject_id, user=request.user)
    history = ChatMessage.objects.filter(subject=subject).order_by('timestamp')
    data = []
    for msg in history:
        try:
            # Try to safely parse citations out of response string, 
            # Or assume we stored citations in a separate field (we didn't, we can pass None for now)
            # A more robust DB structure would separate text, citations, and confidence in the model
            pass
        except:
            pass
            
        data.append({
            'query': msg.query,
            'response': msg.response,
            'citations': None,
            'confidence': None
        })
    return JsonResponse({'history': data})

@csrf_exempt
def generate_quiz(request, subject_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request'}, status=400)
    
    # Ensure the user owns this subject
    subject = get_object_or_404(Subject, id=subject_id, user=request.user)
    
    from .rag_engine import get_full_subject_text
    from langchain_ollama import OllamaLLM
    from langchain_core.prompts import PromptTemplate
    
    full_text = get_full_subject_text(subject.id)
    if not full_text.strip():
        return JsonResponse({'error': 'No notes available to generate a quiz.'}, status=400)
    
    mcq_count = request.GET.get('mcq_count', 5)
    short_count = request.GET.get('short_count', 3)

    template = """You are a senior professor. Based on the following study material for the subject '{subject_name}', generate a comprehensive quiz in JSON format.
    
CRITICAL CONSTRAINTS:
1. Generate EXACTLY {mcq_count} Multiple Choice Questions (MCQs).
2. Generate EXACTLY {short_count} Short-Answer Questions.
3. ORDER: All MCQs must come first in the array, followed by all Short-Answer questions.
4. MCQs MUST have exactly 4 options, a correct answer, and a detailed 'explanation'.
5. Short-Answer questions MUST have a comprehensive 'answer' (model answer).

JSON SCHEMA:
{{
  "questions": [
    {{
      "id": 1,
      "type": "mcq",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option B",
      "explanation": "A detailed explanation of why Option B is correct."
    }},
    {{
      "id": 6,
      "type": "short",
      "question": "Question text here?",
      "answer": "Expected key concepts or sample model answer"
    }}
  ]
}}

Requirements:
- Return ONLY the raw JSON string. Do not include markdown code blocks or any other text.
- No conversational filler.

Material:
{context}

Quiz JSON:"""

    prompt = PromptTemplate.from_template(template)
    filled_prompt = prompt.format(
        subject_name=subject.name,
        context=full_text[:15000],
        mcq_count=mcq_count,
        short_count=short_count
    )
    
    try:
        llm = OllamaLLM(model="llama3.2")
        raw_response = llm.invoke(filled_prompt)
        # Try to parse JSON to ensure it's valid
        import re
        json_match = re.search(r'(\{.*\})', raw_response, re.DOTALL)
        if json_match:
            quiz_json = json.loads(json_match.group(1))
        else:
            quiz_json = json.loads(raw_response)
    except Exception as e:
        return JsonResponse({'error': f"LLM error or JSON parsing error: {str(e)}"}, status=500)
        
    return JsonResponse(quiz_json)

@csrf_exempt
def subject_chat(request, subject_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
        
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request'}, status=400)
        
    # Ensure the user owns this subject
    subject = get_object_or_404(Subject, id=subject_id, user=request.user)
    try:
        data = json.loads(request.body)
        query = data.get('query', '')
    except Exception:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        
    if not query.strip():
        return JsonResponse({'error': 'Query is empty'}, status=400)
        
    # Generate RAG response
    from .rag_engine import query_subject_index
    from langchain_ollama import OllamaLLM
    from langchain_core.prompts import PromptTemplate
    
    # 1. Retrieve Context
    results = query_subject_index(subject.id, query, top_k=3)
    
    # Check if anything was returned
    if not results:
        fallback = f"Not found in your notes for {subject.name}."
        ChatMessage.objects.create(subject=subject, query=query, response=fallback)
        return JsonResponse({
            'response': fallback,
            'citations': [],
            'confidence': 0.0
        })
        
    # Build context string and extract citations
    context_text = ""
    citations = []
    avg_score = 0
    
    for i, res in enumerate(results):
        doc, score = res
        avg_score += score
        snippet = doc.page_content.replace('\n', ' ').strip()
        filename = doc.metadata.get('filename', 'Unknown')
        page_num = doc.metadata.get('page', 'N/A')
        context_text += f"---\nSource Material {i+1} (From {filename}, Page {page_num}):\n{snippet}\n"
        
        citations.append({
            'filename': filename,
            'page': page_num,
            # Just take first 100 chars as a snippet
            'snippet': snippet[:100] + '...' if len(snippet) > 100 else snippet
        })
        
    avg_score = avg_score / len(results) if results else 0
    
    # We invert the similarity score for FAISS L2 distance so lower is better -> turn into confidence %.
    # Typical L2 values vary, let's normalize roughly (this is naive). Just providing the raw score works too.
    confidence = float(max(0, 100 - (avg_score * 50)))
    
    # The Prompt Template enforcing strict responses
    template = """You are a helpful study AI assistant. I will provide you with some context from my notes for the subject '{subject_name}'.
    
Read the notes carefully, and answer my question ONLY using the provided context.
If you cannot find the answer to my question within the context, you MUST reply exactly with the phrase:
"Not found in your notes for {subject_name}." No exceptions. 

Context:
{context}

Question:
{question}

Answer:"""

    prompt = PromptTemplate.from_template(template)
    filled_prompt = prompt.format(
        subject_name=subject.name,
        context=context_text,
        question=query
    )
    
    # Load LLM
    try:
        llm = OllamaLLM(model="llama3.2")
        answer = llm.invoke(filled_prompt)
    except Exception as e:
        answer = f"Error communicating with LLM: Ensure Ollama is running and has model 'llama3.2'. Details: {e}"
        # If no LLM, just fallback
        
    # Check if the LLM followed the fallback
    if f"Not found in your notes for {subject.name}." in answer:
        citations = []
        confidence = 0
        
    # Save the interaction
    ChatMessage.objects.create(
        subject=subject,
        query=query,
        response=answer
    )
    
    return JsonResponse({
        'response': answer,
        'citations': citations,
        'confidence': confidence
    })

def study_mode(request, subject_id):
    return render(request, 'index.html')
