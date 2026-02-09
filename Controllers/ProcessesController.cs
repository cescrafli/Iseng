using Microsoft.AspNetCore.Mvc;

namespace CyberMonitor.Controllers
{
    public class ProcessesController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
