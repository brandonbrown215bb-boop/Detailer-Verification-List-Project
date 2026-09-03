using System;
using System.Windows.Forms;
using Velopack;

namespace AHUVerification.App
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            VelopackApp.Build().Run();
            ApplicationConfiguration.Initialize();
            Application.Run(new MainForm());
        }
    }
}