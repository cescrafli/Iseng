using Microsoft.AspNetCore.Mvc;
using CyberMonitor.Data;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.Controllers
{
    public class HistoryController : Controller
    {
        private readonly ApplicationDbContext _context;

        public HistoryController(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IActionResult> Index()
        {
            // Ambil 100 data terakhir agar loading tidak berat
            var logs = await _context.AnomalyLogs
                .OrderByDescending(l => l.Timestamp)
                .Take(100)
                .ToListAsync();

            return View(logs);
        }
    }
}
