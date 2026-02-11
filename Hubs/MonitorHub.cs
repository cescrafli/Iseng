using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace CyberMonitor.Hubs
{
    public class MonitorHub : Hub
    {
        public async Task SendStats(string statsJson)
        {
            await Clients.All.SendAsync("ReceiveStats", statsJson);
        }

        public async Task SendProcesses(string procsJson)
        {
            await Clients.All.SendAsync("ReceiveProcesses", procsJson);
        }

        public async Task SendDiskInfo(string diskJson)
        {
            await Clients.All.SendAsync("ReceiveDiskInfo", diskJson);
        }

        public async Task KillProcess(int pid)
        {
            try
            {
                var process = System.Diagnostics.Process.GetProcessById(pid);
                process.Kill();
                await Clients.All.SendAsync("ProcessKilled", pid, true, $"Process {pid} killed successfully.");
            }
            catch (System.Exception ex)
            {
                await Clients.Caller.SendAsync("ProcessKilled", pid, false, $"Failed to kill process {pid}: {ex.Message}");
            }
        }
    }
}
