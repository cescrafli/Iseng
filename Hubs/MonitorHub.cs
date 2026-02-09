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
    }
}
