# ⚡ Bandwidth Checker ⚡

> My blog post: [I Built a Bot to Try and Get Money Back From My Internet Provider](https://healeycodes.com/webdev/javascript/python/opensource/2019/08/22/bot-vs-isp.html)

<br>

![preview image](https://github.com/healeycodes/bandwidth-checker/raw/master/graphexample.png "Image of scatter graph bandwidth results")

&nbsp;

Some ISPs promise money back if your bandwidth goes below a certain level.

This project includes two automated methods of testing download speed.
  - Speedtest's CLI.
  - Headless Chromium browser via Netflix's fast.com.

A Node server displays a scatter graph of the recent bandwidth results via Chart.js.

I run my own setup on a Raspberry Pi connected to my router via ethernet.

&nbsp;

## Install

### Client

`cd client`

`pip install requests`

and one of the following

**Speedtest CLI**:

`pip install speedtest-cli`

**Headless browser**:

`pip install selenium`

### Server

`cd server`

`npm install`

&nbsp;

## Run

### Client

Setup a cron job to run either version.

**Speedtest CLI**:

```
cd client
python clitest.py 'https://server-location/save' 'password'
```

Where the arguments are:
- Path to the endpoint to save the results.
- Password for that endpoint.

**Headless browser**:

`python browsertest.py '/usr/lib/chromium-browser/chromedriver' 'https://server-location/save' 'password'`

Where the arguments are:
- Path to the ChromeDriver executable (watch out for version clashes).
- Path to the endpoint to save the results.
- Password for that endpoint.

Each client auto-detects its MAC address, IP, and hostname and sends them along with every
result so the server can attribute readings to the machine that produced them. Set the
`CONNECTION_LABEL` environment variable (e.g. `wifi` or `ethernet`) to tag which kind of
connection that machine is testing — useful when you run the client on more than one machine,
for example one on Wi-Fi and another wired directly into the modem. The dashboard shows each
machine as its own series and lets you pick a machine when viewing the low-speed outlier table
and the daily stability chart.

### Server

Setup password, and port (default: 3000):
```
Unix Bash (Linux, Mac, etc.):
$ export SECRET=hello
$ export PORT=3000

Windows CMD:
> set SECRET=hello
> set PORT=3000

Windows PowerShell:
> $env:SECRET = "hello"
> $env:PORT = "3000"
```

```
cd server
npm start
```

Visit the root path `/` to view bandwidth results.

Bandwidth results are stored by the client via `/save`

&nbsp;

### Contributing

Feel free to raise any issues and submit any reasonable pull requests.

&nbsp;

### License

MIT (see LICENSE.md).
