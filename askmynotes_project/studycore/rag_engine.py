import os
from PyPDF2 import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from django.conf import settings

# Initialize local embedding model
# We use all-MiniLM-L6-v2 directly using HuggingFaceEmbeddings since it runs offline
# Warning: First run may download weights if not already cached
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def get_faiss_index_path(subject_id):
    """Return the file path for a subject's index."""
    os.makedirs(os.path.join(settings.BASE_DIR, 'faiss_indexes'), exist_ok=True)
    return os.path.join(settings.BASE_DIR, 'faiss_indexes', f'subject_{subject_id}')

def extract_text_from_file(file_path):
    """Extract text and page numbers depending on file extension."""
    ext = os.path.splitext(file_path)[1].lower()
    pages_data = [] # List of {"text": str, "page": int}
    
    if ext == '.pdf':
        try:
            reader = PdfReader(file_path)
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    pages_data.append({"text": page_text, "page": i + 1})
        except Exception as e:
            print(f"Error reading PDF {file_path}: {e}")
    elif ext == '.txt':
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
                if text:
                    pages_data.append({"text": text, "page": 1})
        except Exception as e:
            print(f"Error reading TXT {file_path}: {e}")
            
    return pages_data

def process_and_embed_file(file_path, subject_id, filename):
    """Extract, chunk, embed, and save to subject's FAISS index."""
    pages_data = extract_text_from_file(file_path)
    if not pages_data:
        return False
        
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", " ", ""]
    )
    
    all_chunks = []
    for data in pages_data:
        chunks = splitter.create_documents(
            [data["text"]], 
            metadatas=[{"filename": filename, "page": data["page"]}]
        )
        all_chunks.extend(chunks)
    
    index_path = get_faiss_index_path(subject_id)
    
    if os.path.exists(index_path):
        # Load existing index and add new chunks
        vectorstore = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
        vectorstore.add_documents(all_chunks)
    else:
        # Create new index for this subject
        vectorstore = FAISS.from_documents(all_chunks, embeddings)
        
    vectorstore.save_local(index_path)
    return True

def query_subject_index(subject_id, query, top_k=3):
    """Retrieve top chunks for a given query in a subject's index."""
    index_path = get_faiss_index_path(subject_id)
    
    if not os.path.exists(index_path):
        return []
        
    vectorstore = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
    # Return similarity results with scores
    results = vectorstore.similarity_search_with_score(query, k=top_k)
    return results

def get_full_subject_text(subject_id):
    """Helper to retrieve all texts for generating study quizzes."""
    # Getting all raw text directly from FAISS requires fetching all vectors
    # A simpler way is to query empty string or aggregate chunks
    index_path = get_faiss_index_path(subject_id)
    if not os.path.exists(index_path):
        return ""
        
    vectorstore = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
    # Using similarity search with blank string and large k to get all/most documents
    results = vectorstore.similarity_search("", k=1000)
    
    full_text = []
    for doc in results:
        full_text.append(doc.page_content)
        
    return "\n\n".join(full_text)
