using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using CyberMonitor.Models;

namespace CyberMonitor.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;

    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        ViewBag.MachineName = Environment.MachineName;
        ViewBag.OSVersion = Environment.OSVersion.ToString();
        
        var uptime = TimeSpan.FromMilliseconds(Environment.TickCount64);
        ViewBag.Uptime = $"{uptime.Days}d {uptime.Hours}h {uptime.Minutes}m";

        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
