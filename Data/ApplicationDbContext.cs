using Microsoft.EntityFrameworkCore;
using CyberMonitor.Models;

namespace CyberMonitor.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<AnomalyLog> AnomalyLogs { get; set; }
    }
}
