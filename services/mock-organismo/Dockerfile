# Este servicio NO se despliega a AWS -- solo simula un tercero externo para
# poder correr y demostrar la demo por completo en local.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
