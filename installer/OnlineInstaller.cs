using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class OnlineInstaller
{
    const string Repository = "__REPOSITORY__";
    internal sealed class Asset {
        public string name { get; set; }
        public string digest { get; set; }
        public string browser_download_url { get; set; }
        public long size { get; set; }
    }
    internal sealed class Release {
        public string tag_name { get; set; }
        public bool draft { get; set; }
        public bool prerelease { get; set; }
        public Asset[] assets { get; set; }
    }
    internal static Asset SelectAsset(Release release) {
        if (release == null || release.draft || release.prerelease || release.assets == null)
            throw new InvalidDataException("Nenhuma versão estável disponível.");
        Asset found = null;
        foreach (Asset asset in release.assets) {
            if (!Regex.IsMatch(asset.name ?? "", @"^PokeIdle-Multi-Setup-\d+\.\d+\.\d+\.exe$")) continue;
            if (found != null) throw new InvalidDataException("Mais de um instalador encontrado.");
            found = asset;
        }
        if (found == null || found.size <= 0 || found.size > 2147483648L ||
            !Regex.IsMatch(found.digest ?? "", "^sha256:[a-fA-F0-9]{64}$"))
            throw new InvalidDataException("Instalador sem tamanho ou verificação SHA-256 válida.");
        Uri url;
        if (!Uri.TryCreate(found.browser_download_url, UriKind.Absolute, out url) ||
            url.Scheme != "https" || url.Host != "github.com" || !url.IsDefaultPort ||
            !url.AbsolutePath.StartsWith("/" + Repository + "/releases/download/", StringComparison.Ordinal) ||
            url.UserInfo != "") throw new InvalidDataException("Endereço de download inválido.");
        return found;
    }
    internal static void Verify(string path, Asset asset) {
        if (new FileInfo(path).Length != asset.size) throw new InvalidDataException("Download incompleto.");
        using (var stream = File.OpenRead(path))
        using (var sha = SHA256.Create()) {
            string actual = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "");
            if (!String.Equals("sha256:" + actual, asset.digest, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("O arquivo não passou na verificação de integridade. Tente novamente.");
        }
    }
    internal static async Task<string> Download(string folder, Action<string, int> report, CancellationToken token) {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        using (var client = new HttpClient()) {
            client.Timeout = TimeSpan.FromMinutes(30);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("PokeIdle-Multi-Online-Installer/1.0");
            report("Consultando a última versão estável…", 0);
            string json;
            using (var metadataTimeout = CancellationTokenSource.CreateLinkedTokenSource(token)) {
                metadataTimeout.CancelAfter(TimeSpan.FromSeconds(60));
                using (var response = await client.GetAsync("https://api.github.com/repos/" + Repository + "/releases/latest", metadataTimeout.Token)) {
                    response.EnsureSuccessStatusCode();
                    json = await response.Content.ReadAsStringAsync();
                }
            }
            var release = new JavaScriptSerializer().Deserialize<Release>(json);
            var asset = SelectAsset(release);
            string path = Path.Combine(folder, asset.name);
            using (var response = await client.GetAsync(asset.browser_download_url, HttpCompletionOption.ResponseHeadersRead, token)) {
                response.EnsureSuccessStatusCode();
                using (var input = await response.Content.ReadAsStreamAsync())
                using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true)) {
                    byte[] buffer = new byte[81920];
                    long total = 0;
                    int count;
                    while ((count = await input.ReadAsync(buffer, 0, buffer.Length, token)) != 0) {
                        total += count;
                        if (total > asset.size) throw new InvalidDataException("Tamanho de download inesperado.");
                        await output.WriteAsync(buffer, 0, count, token);
                        report(String.Format("Baixando {0}: {1:0.0} / {2:0.0} MB", release.tag_name, total / 1048576.0, asset.size / 1048576.0), (int)(total * 100 / asset.size));
                    }
                }
            }
            report("Verificando a integridade do instalador…", 100);
            await Task.Run(() => Verify(path, asset), token);
            token.ThrowIfCancellationRequested();
            return path;
        }
    }
    [STAThread]
    static int Main(string[] args) {
        if (args.Length == 1 && args[0] == "--self-test") {
            try { SelfTest(); Console.WriteLine("Self-tests OK"); return 0; }
            catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
        }
        if (args.Length == 1 && args[0] == "--verify-only") {
            string folder = NewFolder();
            try {
                Download(folder, (message, percent) => {}, CancellationToken.None).GetAwaiter().GetResult();
                Console.WriteLine("Download e SHA-256 OK; instalação não iniciada."); return 0;
            } catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
            finally { Cleanup(folder); }
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InstallerForm());
        return 0;
    }
    internal static string NewFolder() {
        string folder = Path.Combine(Path.GetTempPath(), "PokeIdle-Install-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder); return folder;
    }
    internal static void Cleanup(string folder) {
        if (folder == null) return;
        try { Directory.Delete(folder, true); } catch (IOException) {} catch (UnauthorizedAccessException) {}
    }
    static void SelfTest() {
        string folder = NewFolder();
        try {
            string path = Path.Combine(folder, "test"); File.WriteAllText(path, "abc");
            var asset = new Asset { name = "PokeIdle-Multi-Setup-0.1.1.exe", size = 3,
                digest = "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                browser_download_url = "https://github.com/" + Repository + "/releases/download/v0.1.1/test.exe" };
            var release = new Release { assets = new [] {asset} };
            SelectAsset(release); Verify(path, asset);
            File.WriteAllText(path, "abd"); ExpectFailure(() => Verify(path, asset));
            File.WriteAllText(path, "ab"); ExpectFailure(() => Verify(path, asset));
            release.prerelease = true; ExpectFailure(() => SelectAsset(release)); release.prerelease = false;
            asset.browser_download_url = "https://example.com/test.exe"; ExpectFailure(() => SelectAsset(release));
            asset.browser_download_url = "https://github.com/" + Repository + "/releases/download/v0.1.1/test.exe";
            string digest = asset.digest;
            asset.digest = null; ExpectFailure(() => SelectAsset(release)); asset.digest = digest;
            release.assets = new [] {asset, asset}; ExpectFailure(() => SelectAsset(release));
            release.assets = new Asset[0]; ExpectFailure(() => SelectAsset(release));
        } finally { Cleanup(folder); }
    }
    static void ExpectFailure(Action action) {
        try { action(); } catch (InvalidDataException) { return; }
        throw new Exception("Entrada inválida foi aceita.");
    }
    sealed class InstallerForm : Form {
        readonly Label status = new Label { Left = 24, Top = 24, Width = 440, Height = 60,
            Text = "Baixe e instale a última versão estável do PokeIdle Multi. É necessária uma conexão com a internet." };
        readonly ProgressBar progress = new ProgressBar { Left = 24, Top = 96, Width = 440, Height = 22 };
        readonly Button start = new Button { Left = 24, Top = 140, Width = 210, Height = 36, Text = "Baixar e instalar" };
        readonly Button cancel = new Button { Left = 254, Top = 140, Width = 210, Height = 36, Text = "Fechar" };
        CancellationTokenSource cancellation;
        bool busy, installing;
        internal InstallerForm() {
            Text = "PokeIdle Multi — Instalação"; ClientSize = new Size(488, 200);
            FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen; AutoScaleMode = AutoScaleMode.Dpi;
            Controls.AddRange(new Control[] {status, progress, start, cancel});
            start.Click += async (sender, args) => await Run();
            cancel.Click += (sender, args) => { if (busy) cancellation.Cancel(); else Close(); };
            FormClosing += (sender, args) => { if (busy || installing) { args.Cancel = true; if (busy) cancellation.Cancel(); } };
        }
        async Task Run() {
            if (!Environment.Is64BitOperatingSystem) { status.Text = "Este aplicativo requer Windows de 64 bits."; return; }
            busy = true; start.Enabled = false; cancel.Text = "Cancelar";
            cancellation = new CancellationTokenSource();
            cancellation.CancelAfter(TimeSpan.FromMinutes(30));
            string folder = null;
            try {
                folder = NewFolder();
                string path = await Download(folder, (message, percent) => { status.Text = message; progress.Value = percent; }, cancellation.Token);
                busy = false; installing = true; cancel.Enabled = false;
                status.Text = "Siga as instruções na janela do instalador…";
                using (var process = Process.Start(new ProcessStartInfo(path) { UseShellExecute = true })) {
                    await Task.Run(() => process.WaitForExit());
                    status.Text = process.ExitCode == 0 ? "Instalador concluído." : "Instalação cancelada ou não concluída. Você pode tentar novamente.";
                }
            } catch (OperationCanceledException) { status.Text = "Download cancelado ou tempo de espera excedido. Você pode tentar novamente."; }
            catch (Exception ex) { status.Text = "Não foi possível concluir. Confira a conexão e tente novamente."; MessageBox.Show(this, ex.Message, "Falha na instalação", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
            finally {
                Cleanup(folder); busy = false; installing = false; cancellation.Dispose();
                start.Enabled = true; cancel.Enabled = true; cancel.Text = "Fechar";
            }
        }
    }
}
