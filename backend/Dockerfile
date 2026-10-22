FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY . .
RUN useradd --uid 10001 --create-home bookapp \
    && mkdir -p app/static/books app/static/book_html app/static/images/Book .cache/tts \
    && chown -R bookapp:bookapp /app
USER bookapp
EXPOSE 5000
CMD ["sh", "-c", "python migrate.py && uvicorn main:app --host 0.0.0.0 --port 5000 --proxy-headers --forwarded-allow-ips='*'"]
