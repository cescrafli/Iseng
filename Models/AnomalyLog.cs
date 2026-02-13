using System.ComponentModel.DataAnnotations;

namespace CyberMonitor.Models
{
    public class AnomalyLog
    {
        [Key]
        public int Id { get; set; }
        
        public string Type { get; set; } = string.Empty; // CPU, MEMORY, DISK
        public string Severity { get; set; } = string.Empty; // CRITICAL, WARNING
        public string Message { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.Now;
    }
}
