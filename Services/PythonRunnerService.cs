using Microsoft.AspNetCore.SignalR;
using CyberMonitor.Hubs;
using System.Diagnostics;

namespace CyberMonitor.Services
{
    public class PythonRunnerService : BackgroundService
    {
        private readonly IHubContext<MonitorHub> _hubContext;
        private readonly ILogger<PythonRunnerService> _logger;

        public PythonRunnerService(IHubContext<MonitorHub> hubContext, ILogger<PythonRunnerService> logger)
        {
            _hubContext = hubContext;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("PythonRunnerService is starting.");

            var processStartInfo = new ProcessStartInfo
            {
                FileName = "python", // Assuming python is in PATH
                Arguments = "stats_collector.py",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = Directory.GetCurrentDirectory()
            };

            using var process = new Process { StartInfo = processStartInfo };

            try
            {
                process.Start();
                _logger.LogInformation("Python script started.");

                while (!stoppingToken.IsCancellationRequested && !process.HasExited)
                {
                    string output = await process.StandardOutput.ReadLineAsync();
                    if (!string.IsNullOrEmpty(output))
                    {
                        if (output.StartsWith("STATS:"))
                        {
                            await _hubContext.Clients.All.SendAsync("ReceiveStats", output.Substring(6), cancellationToken: stoppingToken);
                        }
                        else if (output.StartsWith("PROCS:"))
                        {
                            await _hubContext.Clients.All.SendAsync("ReceiveProcesses", output.Substring(6), cancellationToken: stoppingToken);
                        }
                        else if (output.StartsWith("DISK:"))
                        {
                            await _hubContext.Clients.All.SendAsync("ReceiveDiskInfo", output.Substring(5), cancellationToken: stoppingToken);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running Python script.");
            }
            finally
            {
                if (!process.HasExited)
                {
                    process.Kill();
                }
                _logger.LogInformation("PythonRunnerService is stopping.");
            }
        }
    }
}
