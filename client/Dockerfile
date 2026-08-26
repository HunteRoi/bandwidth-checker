FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY clitest.py ./

# TEST_INTERVAL controls the delay (in seconds) between each speed test
CMD ["sh", "-c", "while true; do python clitest.py \"$SERVER_URL\" \"$SECRET\"; sleep \"${TEST_INTERVAL:-3600}\"; done"]
