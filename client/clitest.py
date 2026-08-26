import os
import socket
import sys
import uuid
import speedtest
import time
import requests


def get_machine_meta():
    """
    Identify this machine so the server can attribute results to it.
        :return: Dictionary of mac, ip, hostname, and connection label
    """
    mac_int = uuid.getnode()
    mac = ':'.join(f'{(mac_int >> shift) & 0xff:02x}' for shift in range(40, -1, -8))
    ip = None
    try:
        # connect to an external address (no data sent) to discover the outbound IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
    except OSError:
        pass
    return {
        'mac': mac,
        'ip': ip,
        'hostname': socket.gethostname(),
        'connection': os.getenv('CONNECTION_LABEL', ''),
    }


def get_speed():
    """
    Use Speedtest CLI to test bandwidth speed.
        :return: Download speed in Mbps
    """
    s = speedtest.Speedtest()
    s.download()
    results_dict = s.results.dict()
    return results_dict['download'] / 1048576  # convert bits to megabits


def send_speed(url, data, pw):
    """
    Send bandwidth result to external source.
        :param url: Endpoint to send a POST request to
        :param data: Dictionary of speed, units, and time
        :param pw: Password for the endpoint
        :return: status code of the request
    """
    data['pw'] = pw
    r = requests.post(url, json=data)
    return r.status_code


if __name__ == '__main__':
    endpoint = sys.argv[1]  # endpoint to save results
    pw = sys.argv[2]  # password for endpoint
    speed = get_speed()
    data = {"speed": speed, "units": "Mbps", "date": time.time(), **get_machine_meta()}
    status = send_speed(endpoint, data, pw)
    print(status)
