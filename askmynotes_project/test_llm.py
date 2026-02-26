import json
import re
from langchain_core.prompts import PromptTemplate
from langchain_ollama import OllamaLLM

mcq_count = 5
short_count = 3
subject_name = "Test"
full_text = "test material"

template = """You are a senior professor. Based on the following study material for the subject '{subject_name}', generate a comprehensive quiz in JSON format.

CRITICAL CONSTRAINTS:
1. Generate EXACTLY {mcq_count} Multiple Choice Questions (type: "mcq").
2. Generate EXACTLY {short_count} Short-Answer Questions (type: "short").
3. ORDER: All MCQs must come first in the array, followed by all Short-Answer questions.
4. MCQs MUST have exactly 4 options, a correct 'answer', and a detailed 'explanation'.
5. Short-Answer questions MUST have a comprehensive 'answer' (model answer).
6. IT IS CRITICAL THAT YOU OUTPUT BOTH TYPES OF QUESTIONS. Do not only generate MCQs.

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
- YOU MUST ENFORCE THE COUNTS EXACTLY.

Material:
{context}

Quiz JSON:"""

prompt = PromptTemplate.from_template(template)
filled_prompt = prompt.format(
    subject_name=subject_name,
    context=full_text,
    mcq_count=mcq_count,
    short_count=short_count
)

try:
    llm = OllamaLLM(model="llama3.2")
    raw_response = llm.invoke(filled_prompt)
    print("Raw Response:", raw_response)
    
    json_match = re.search(r'(\{.*\})', raw_response, re.DOTALL)
    if json_match:
        print("Regex matched.")
        quiz_json = json.loads(json_match.group(1))
    else:
        print("No regex match.")
        quiz_json = json.loads(raw_response)
    print("SUCCESS JSON parsed")
except Exception as e:
    print("EXCEPTION:", repr(e))
