using Microsoft.AspNetCore.SignalR;
using CyberMonitor.Hubs;
using System.Diagnostics;

namespace CyberMonitor.Services
{
    public class PythonRunnerService : BackgroundService
    {
        private readonly IHubContext<MonitorHub> _hubContext;
        private readonly ILogger<PythonRunnerService> _logger;
        private readonly IConfiguration _configuration; // Added this field

        public PythonRunnerService(IHubContext<MonitorHub> hubContext, ILogger<PythonRunnerService> logger, IConfiguration configuration) // Modified constructor
        {
            _hubContext = hubContext;
            _logger = logger;
            _configuration = configuration; // Assigned configuration
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("PythonRunnerService is starting.");

            // 1. Lokasi Script (Otomatis ikut di mana aplikasi diinstall)
            string basePath = AppDomain.CurrentDomain.BaseDirectory;
            string scriptPath = Path.Combine(basePath, "stats_collector.py");

            // 2. Lokasi Python (Dari Config) // Updated comment
            string pythonPath = _configuration["PythonPath"] ?? @"D:\LENOVO\Downloads\ZIP\Python\python.exe"; // Fallback // Modified to use IConfiguration

            _logger.LogInformation($"Using Python at: {pythonPath}");
            _logger.LogInformation($"Looking for script at: {scriptPath}");

            var processStartInfo = new ProcessStartInfo
            {
                FileName = pythonPath, 
                Arguments = $"\"{scriptPath}\"", 
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = basePath 
            };

            using var process = new Process { StartInfo = processStartInfo };

            try
            {
                process.Start();
                _logger.LogInformation($"Python script started successfully. PID: {process.Id}");

                while (!stoppingToken.IsCancellationRequested && !process.HasExited)
                {
                    string? output = await process.StandardOutput.ReadLineAsync(stoppingToken);
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
                _logger.LogError(ex, "FATAL ERROR running Python script. Check Path & Permissions!");
            }
            finally
            {
                if (process != null && !process.HasExited)
                {
                    try { process.Kill(); } catch { }
                }
                _logger.LogInformation("PythonRunnerService is stopping.");
            }
        }
    }
}