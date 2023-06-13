const { ipcRenderer } = require('electron');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const close = document.getElementById('close');
const minimize = document.getElementById('minimize');
const scanButton = document.getElementById('scan');

close.addEventListener('click', () => {
    ipcRenderer.send('close');
});

minimize.addEventListener('click', () => {
    ipcRenderer.send('minimize');
});

const Notification = {
    show(mode, message) {
        const container = document.getElementById('content');
        const NotificationContainer = document.createElement('div');
        const NotificationContent = document.createElement('div');
        NotificationContainer.classList.add('notification-bar');
        NotificationContent.classList.add('notification-content');
        NotificationContent.innerHTML = message;
        NotificationContainer.appendChild(NotificationContent);
        NotificationContainer.style.marginTop = `${50 * document.getElementsByClassName('notification-bar').length}px`;
        switch (mode) {
            case 'success':
                NotificationContainer.style.borderRight = '4px solid #61c555';
                break;
            case 'error':
                NotificationContainer.style.borderRight = '4px solid #ed6a5e';
                break;
            case 'information':
                NotificationContainer.style.borderRight = '4px solid #3f78c4';
                break;
            case 'warn':
                NotificationContainer.style.borderRight = '4px solid #f4c04e';
                break;
            default:
                NotificationContainer.style.borderRight = '4px solid #3f78c4';
                break;
        }
        container.appendChild(NotificationContainer);
        this.clear(NotificationContainer);
    },
    clear(notification) {
        setTimeout(() => {
            const notifications = document.getElementsByClassName('notification-bar');
            for (let i = 0; i < notifications.length; i++) {
                notifications[i].style.marginTop = `${50 * i - 50}px`;
            }
            notification.remove();
        }, 3000);
    }
}

// read and parse https://raw.githubusercontent.com/Lillious/port-checker/main/config.json using fetch
fetch('https://raw.githubusercontent.com/Lillious/port-checker/main/config.json') 
.then(response => response.json())
.then(data => {
    // Check if config.json exists and doesn't contain the same data as the one on github
    if (fs.existsSync('config.json') && JSON.stringify(data) === fs.readFileSync('config.json', 'utf8')) return;
    // Delete config.json if it exists
    if (fs.existsSync('config.json')) fs.unlinkSync('config.json');
    // Create config.json and write the data from github to it
    fs.writeFileSync('config.json', JSON.stringify(data, null, 4), 'utf8');

    // Try to read config.json again to make sure it exists
    if (!fs.existsSync('config.json')) {
        Notification.show('error', 'Failed to create config file');
        return;
    } else {
        // Attempt to parse config.json as JSON to make sure it's valid
        try {
            JSON.parse(fs.readFileSync('config.json', 'utf8'));
            Notification.show('success', 'Config file loaded successfully');
            scanButton.disabled = false;
        }
        catch (err) {
            Notification.show('error', 'Failed to parse config file');
            return;
        }
    }
})
.catch(err => {
    console.log(err);
    Notification.show('error', 'Failed to fetch config file');
});

async function start () {
    Notification.show('information', 'Started scanning...');
    try {
        // Read and parse config.json
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

        // Clear the scroll box
        document.getElementsByClassName('scroll-box-content')[0].innerHTML = '';

        for (let i = 0; i < config.hosts.length; i++) {
            let hostname = config.hosts[i][0];
            let port = config.hosts[i][1];
            // Create a pending slot element
            const pendingElement = createSlotElement(hostname, port, '&#8230;');
            if (pendingElement.innerHTML != '&#8230;') pendingElement.innerHTML = '...';
            pendingElement.style.marginRight = '5.5px';
            
            // Greyscale the pending slot element
            pendingElement.style.filter = 'grayscale(50%)';
            // Check if the host is reachable on the specified port
            const result = await ping(hostname, port);
            if (result) {
                pendingElement.style.filter = 'none';
                pendingElement.style.marginRight = '0px';
                pendingElement.innerHTML = '&#128994;';
                if (pendingElement.innerHTML != '&#128994;') pendingElement.innerHTML = 'Online';
            } else {
                pendingElement.style.filter = 'none';
                pendingElement.style.marginRight = '0px'
                pendingElement.innerHTML = '&#128308;';
                if (pendingElement.innerHTML != '&#128308;') pendingElement.innerHTML = 'Offline';
            }
        }
        Notification.show('success', 'Scan completed');
        scanButton.disabled = false;
        scanButton.innerHTML = 'Scan';
    } catch (err) {
        Notification.show('error', 'An error occured while scanning');
        scanButton.disabled = false;
        scanButton.innerHTML = 'Scan';
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
    slot.appendChild(hostname);
    slot.appendChild(status);
    parent.appendChild(slot); 
    // scroll to the bottom of scroll box after each element is created
    container.scrollTop = container.scrollHeight;
    // Return the element so it can be modified later
    return status;
}

document.getElementById('scan').addEventListener('click', () => {
    // Disable button to prevent multiple scans
    scanButton.disabled = true;
    scanButton.innerHTML = 'Scanning...';
    start();
});
