const { ipcRenderer } = require('electron');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const close = document.getElementById('close');
const minimize = document.getElementById('minimize');
const maximize = document.getElementById('maximize');

close.addEventListener('click', () => {
    ipcRenderer.send('close');
});

minimize.addEventListener('click', () => {
    ipcRenderer.send('minimize');
});

maximize.addEventListener('click', () => {
    ipcRenderer.send('maximize');
});

// read and parse https://raw.githubusercontent.com/Lillious/port-checker/main/config.json using fetch
fetch('https://raw.githubusercontent.com/Lillious/port-checker/main/config.json') 
.then(response => response.json())
.then(data => {
    // Write the data to config.json
    fs.writeFileSync('config.json', JSON.stringify(data, null, 4));
})
.catch(err => {
    console.log(err)
});

const scanButton = document.getElementById('scan');
const toast = document.getElementById('toast');
var scanned = 0; // Counter for the number of items that have been scanned

async function start () {
    // Read and parse config.json
    const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

    // Clear the scroll box
    document.getElementsByClassName('scroll-box-content')[0].innerHTML = '';

    for (let i = 0; i < config.hosts.length; i++) {
        let hostname = config.hosts[i][0];
        let port = config.hosts[i][1];
        toast.innerHTML = `<b>Scanning:</b> ${hostname}:${port}`;
        const result = await ping(hostname, port);
        if (result) {
            createSlotElement(hostname, port, 'Online');
        } else {
            createSlotElement(hostname, port, 'Offline');
        }
        toast.innerHTML = 'Scan complete!';
    }
}

async function ping (host, port) {
    // Check if powershell is installed on the system
    const PowerShellVersion = await exec('powershell $PSVersionTable');
    if (PowerShellVersion.stderr) throw new Error(PowerShellVersion.stderr);
    // Test-NetConnection is a PowerShell command that tests the connection to a host on a specified port.
    // If the connection is successful, it returns a string that includes 'TcpTestSucceeded : True'
    if (port > 65535) return false;
    const {stdout, stderr} = await exec(`powershell Test-NetConnection ${host} -p ${port}`);
    if (stderr) throw new Error(stderr);
    // Check if the connection was successful or not and return the result accordingly
    if (stdout.includes('TcpTestSucceeded : True')) return true;
    return false;
}

function createSlotElement (_hostname, _port, _status) {
    let container = document.getElementsByClassName('scroll-box')[0];
    let parent = document.getElementsByClassName('scroll-box-content')[0];
    let slot = document.createElement('div');
    slot.classList.add('slot');
    let hostname = document.createElement('div');
    hostname.id = 'hostname';
    hostname.innerHTML = `${_hostname}:${_port}`;
    let status = document.createElement('div');
    status.id = 'status';
    status.innerHTML = _status;
    if (_status === 'Online') status.style.color = '#61c555';
    if (_status === 'Offline') status.style.color = '#ed6a5e';
    slot.appendChild(hostname);
    slot.appendChild(status);
    parent.appendChild(slot); 
    // scroll to the bottom of scroll box after each element is created
    container.scrollTop = container.scrollHeight;

}

document.getElementById('scan').addEventListener('click', () => {
    // Disable button to prevent multiple scans
    scanButton.disabled = true;
    start();
});