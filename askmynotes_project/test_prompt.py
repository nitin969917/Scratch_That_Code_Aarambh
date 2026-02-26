from langchain_core.prompts import PromptTemplate

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

try:
    prompt = PromptTemplate.from_template(template)
    filled_prompt = prompt.format(
        subject_name=subject_name,
        context=full_text,
        mcq_count=mcq_count,
        short_count=short_count
    )
    print("SUCCESS")
except Exception as e:
    print("ERROR:", repr(e))
