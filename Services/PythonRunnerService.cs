using Microsoft.AspNetCore.SignalR;
using CyberMonitor.Hubs;
using System.Diagnostics;
using CyberMonitor.Data;
using CyberMonitor.Models;
using System.Text.Json;

namespace CyberMonitor.Services
{
    public class PythonRunnerService : BackgroundService
    {
        private readonly IHubContext<MonitorHub> _hubContext;
        private readonly ILogger<PythonRunnerService> _logger;
        private readonly IConfiguration _configuration;
        private readonly IServiceScopeFactory _scopeFactory;

        public PythonRunnerService(IHubContext<MonitorHub> hubContext, 
            ILogger<PythonRunnerService> logger, 
            IConfiguration configuration,
            IServiceScopeFactory scopeFactory)
        {
            _hubContext = hubContext;
            _logger = logger;
            _configuration = configuration;
            _scopeFactory = scopeFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("PythonRunnerService is starting...");

            string basePath = AppDomain.CurrentDomain.BaseDirectory;
            string scriptPath = Path.Combine(basePath, "Scripts", "stats_collector.py");

            string pythonPath = _configuration["PythonPath"] ?? "python"; 

            _logger.LogInformation($"Base Directory: {basePath}");
            _logger.LogInformation($"Script Path: {scriptPath}");
            _logger.LogInformation($"Python Executable: {pythonPath}");

            if (!File.Exists(scriptPath))
            {
                _logger.LogError($"FATAL: File script tidak ditemukan di {scriptPath}. Pastikan sudah di-publish!");
                return;
            }

            var processStartInfo = new ProcessStartInfo
            {
                FileName = pythonPath,
                Arguments = $"\"{scriptPath}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = basePath
            };

            using var process = new Process { StartInfo = processStartInfo };

            try
            {
                process.Start();
                _logger.LogInformation($"Python script started. PID: {process.Id}");

                _ = Task.Run(async () =>
                {
                    try
                    {
                        string errorMsg = await process.StandardError.ReadToEndAsync(stoppingToken);
                        if (!string.IsNullOrWhiteSpace(errorMsg))
                        {
                            _logger.LogError($"PYTHON ERROR OUTPUT: {errorMsg}");
                        }
                    }
                    catch { /* Ignore error reading if process killed */ }
                }, stoppingToken);

                while (!stoppingToken.IsCancellationRequested && !process.HasExited)
                {
                    string? output = await process.StandardOutput.ReadLineAsync(stoppingToken);
                    
                    if (!string.IsNullOrEmpty(output))
                    { 

                        if (output.StartsWith("STATS:"))
                        {
                            var jsonStr = output.Substring(6);
                            await _hubContext.Clients.All.SendAsync("ReceiveStats", jsonStr, cancellationToken: stoppingToken);

                            // Parse and save anomalies
                            try
                            {
                                using (var doc = JsonDocument.Parse(jsonStr))
                                {
                                    if (doc.RootElement.TryGetProperty("anomalies", out var anomaliesElement) && 
                                        anomaliesElement.ValueKind == JsonValueKind.Array && 
                                        anomaliesElement.GetArrayLength() > 0)
                                    {
                                        using (var scope = _scopeFactory.CreateScope())
                                        {
                                            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                                            foreach (var anomaly in anomaliesElement.EnumerateArray())
                                            {
                                                var log = new AnomalyLog
                                                {
                                                    Type = anomaly.GetProperty("type").GetString() ?? "UNKNOWN",
                                                    Severity = anomaly.GetProperty("severity").GetString() ?? "INFO",
                                                    Message = anomaly.GetProperty("message").GetString() ?? "No message",
                                                    Timestamp = DateTime.Now
                                                };
                                                dbContext.AnomalyLogs.Add(log);
                                            }
                                            await dbContext.SaveChangesAsync(stoppingToken);
                                            _logger.LogInformation($"Saved {anomaliesElement.GetArrayLength()} anomalies to database.");
                                        }
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Error parsing/saving anomalies.");
                            }
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
                _logger.LogError(ex, "FATAL ERROR saat menjalankan Python process.");
            }
            finally
            {
                if (process != null && !process.HasExited)
                {
                    _logger.LogWarning("Killing Python process...");
                    try { process.Kill(); } catch { }
                }
                _logger.LogInformation("PythonRunnerService stopped.");
            }
        }
    }
}