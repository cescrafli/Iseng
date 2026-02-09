using Microsoft.AspNetCore.Mvc;

namespace CyberMonitor.Controllers
{
    public class SystemController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
