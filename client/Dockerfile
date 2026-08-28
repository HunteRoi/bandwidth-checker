FROM python:3.11-slim
WORKDIR /app

# install the official Ookla Speedtest CLI (speedtest-cli PyPI package underreports on fast links)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gnupg ca-certificates \
    && curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | bash \
    && apt-get install -y --no-install-recommends speedtest \
    && apt-get purge -y curl gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY clitest.py ./

# TEST_INTERVAL controls the delay (in seconds) between each speed test
CMD ["sh", "-c", "while true; do python clitest.py \"$SERVER_URL\" \"$SECRET\"; sleep \"${TEST_INTERVAL:-3600}\"; done"]
