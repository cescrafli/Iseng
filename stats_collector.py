import time
import json
import psutil
import sys
import threading
from collections import deque
import math

class AnomalyDetector:
    def __init__(self, window_size=60):
        self.cpu_history = deque(maxlen=window_size)
        self.mem_history = deque(maxlen=window_size)

    def _calculate_stats(self, data):
        if len(data) < 10: 
            return None, None
        
        mean = sum(data) / len(data)
        variance = sum([((x - mean) ** 2) for x in data]) / len(data)
        std_dev = math.sqrt(variance)
        return mean, std_dev

    def check(self, cpu, mem):
        anomalies = []
        c_mean, c_std = self._calculate_stats(self.cpu_history)
        if c_mean is not None and c_std > 0.5:
            z_score = (cpu - c_mean) / c_std
            if z_score > 3:
                anomalies.append({"type": "CPU", "severity": "CRITICAL", "message": f"CPU Spike! (Z: {z_score:.1f})"})
        
        m_mean, m_std = self._calculate_stats(self.mem_history)
        if m_mean is not None and m_std > 0.5:
            z_score = (mem - m_mean) / m_std
            if z_score > 3:
                anomalies.append({"type": "MEMORY", "severity": "CRITICAL", "message": f"Memory Surge! (Z: {z_score:.1f})"})

        self.cpu_history.append(cpu)
        self.mem_history.append(mem)
        return anomalies

detector = AnomalyDetector()

def get_sys_stats(last_net, last_time):
    cpu = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory().percent
    current_net = psutil.net_io_counters()
    current_time = time.time()
    
    time_diff = current_time - last_time
    if time_diff == 0: time_diff = 1
    
    sent_per_sec = (current_net.bytes_sent - last_net.bytes_sent) / time_diff / 1024
    recv_per_sec = (current_net.bytes_recv - last_net.bytes_recv) / time_diff / 1024
    
    anomalies = detector.check(cpu, mem)

    return {
        "cpu": cpu,
        "memory": mem,
        "network_in": round(recv_per_sec, 1),
        "network_out": round(sent_per_sec, 1),
        "anomalies": anomalies 
    }, current_net, current_time

def get_processes():
    # HAPUS 'username' dari sini karena sering bikin AccessDenied di IIS
    attrs = ['pid', 'name', 'cpu_percent', 'memory_percent']
    procs = []
    
    for p in psutil.process_iter(attrs):
        try:
            p_info = p.info
            # Tambahkan username dummy agar frontend tidak error
            p_info['username'] = "System/Hidden" 
            procs.append(p_info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    
    # Sort by CPU desc
    procs.sort(key=lambda x: x.get('cpu_percent', 0), reverse=True)
    return procs[:20]

def get_disk_info():
    partitions = []
    # Gunakan all=False agar tidak membaca drive network/virtual yang sering error
    for part in psutil.disk_partitions(all=False):
        try:
            # Tambahkan try-except per disk agar 1 disk error tidak mematikan semua
            usage = psutil.disk_usage(part.mountpoint)
            partitions.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent
            })
        except Exception: 
            continue # Skip disk yang tidak bisa dibaca (Access Denied dll)
    return partitions

def main():
    # Configure stdout for UTF-8 (Windows fix)
    try:
        if sys.stdout.encoding.lower() != 'utf-8':
            sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass # Python < 3.7 doesn't support reconfigure

    psutil.cpu_percent()
    last_net = psutil.net_io_counters()
    last_time = time.time()
    tick = 0
    
    # Send Dummy Data immediately to verify pipe
    # print('PROCS:[{"pid":123,"name":"TestProcess","username":"Debug","cpu_percent":5.5,"memory_percent":1.2}]', flush=True)

    while True:
        try:
            # 1. System Stats (Every 1s)
            stats, last_net, last_time = get_sys_stats(last_net, last_time)
            print(f"STATS:{json.dumps(stats)}", flush=True)
            
            # 2. Processes (Every 3s)
            if tick % 3 == 0:
                try:
                    # DEBUG: Send 1 Real Process + 1 Dummy to see if they appear
                    # procs = get_processes() 
                    # If real processes fail, send DUMMY
                    procs = [
                        {"pid": 9999, "name": "DEBUG_PROCESS", "username": "TEST", "cpu_percent": 10.5, "memory_percent": 2.0},
                        {"pid": 8888, "name": "System_Check", "username": "SYSTEM", "cpu_percent": 0.1, "memory_percent": 0.1}
                    ]
                    print(f"PROCS:{json.dumps(procs)}", flush=True)
                except Exception as e:
                    sys.stderr.write(f"Error getting processes: {e}\n")
                    # Send empty list so frontend clears loading state
                    print(f"PROCS:[]", flush=True)

            # 3. Disk Info (Every 10s)
            if tick % 10 == 0:
                try:
                    # DEBUG: Send Dummy Disk
                    # disks = get_disk_info()
                    disks = [
                        {"device": "C:", "mountpoint": "C:\\", "fstype": "NTFS", "total": 100000000000, "used": 50000000000, "free": 50000000000, "percent": 50.0},
                         {"device": "D:", "mountpoint": "D:\\", "fstype": "NTFS", "total": 200000000000, "used": 10000000000, "free": 190000000000, "percent": 5.0}
                    ]
                    print(f"DISK:{json.dumps(disks)}", flush=True)
                except Exception as e:
                    sys.stderr.write(f"Error getting disk: {e}\n")
                    # Send empty list so frontend clears loading state
                    print(f"DISK:[]", flush=True)

            sys.stdout.flush()
            tick += 1
            time.sleep(1)
            
        except Exception as e:
            # Print error ke stderr agar tertangkap oleh log C#
            sys.stderr.write(f"Main Loop Error: {e}\n")
            time.sleep(1)

if __name__ == "__main__":
    main()