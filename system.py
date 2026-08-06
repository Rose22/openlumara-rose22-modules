import os
import platform
import shutil
import json
import subprocess

import core

OS = platform.system().lower()

def _sh(cmd):
    """Helper to run shell commands and return output as string."""
    try:
        out = subprocess.check_output(cmd, shell=True, stderr=subprocess.PIPE)
        return out.decode("utf-8", errors="replace").strip()
    except subprocess.CalledProcessError as e:
        return f"error: {e.stderr.decode('utf-8', errors='replace').strip()}"
    except Exception as e:
        return f"error: {e}"

class System(core.module.Module):
    """
    System information and control module for OpenLumara.
    Provides PC diagnostics, process management, and system control tools.
    """

    dependencies = ["psutil"]

    header = "System"

    settings = {
        # info tools - no settings needed, always safe

        # system control
        "allow_kill_process": {
            "default": False,
            "unsafe": True,
            "description": "Allow killing processes by pid or name"
        },
        "allow_lock_screen": {
            "default": False,
            "unsafe": False,
            "description": "Allow locking the pc screen"
        },
        "allow_network_control": {
            "default": False,
            "unsafe": True,
            "description": "Allow turning internet on/off (linux nmcli)"
        },
        "allow_systemd_control": {
            "default": False,
            "unsafe": True,
            "description": "Allow starting/stopping/restarting systemd services"
        },

        # media control
        "allow_media_control": {
            "default": True,
            "description": "Allow controlling your media player (needs playerctl installed)"
        },

        # package management
        "allow_flatpak_install": {
            "default": False,
            "unsafe": True,
            "description": "Allow installing flatpak packages"
        },
        "allow_flatpak_remove": {
            "default": False,
            "unsafe": True,
            "description": "Allow removing flatpak packages"
        },
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if not self.config.get("allow_kill_process"):
            self.disabled_tools.append("kill_process")

        if not self.config.get("allow_lock_screen"):
            self.disabled_tools.append("lock_screen")

        if not self.config.get("allow_network_control"):
            self.disabled_tools.extend(["turn_network_on", "turn_network_off"])

        if not self.config.get("allow_systemd_control"):
            self.disabled_tools.extend([
                "start_user_service",
                "stop_user_service",
                "kill_user_service"
            ])

        if OS != "linux":
            self.disabled_tools.extend([
                "get_installed_packages",
                "search_linux_packages",
                "flatpak_install_package",
                "flatpak_remove_package",
                "list_user_services",
                "list_system_services",
                "get_system_service_status",
                "get_user_service_status",
                "restart_user_service",
                "kill_user_service",
                "get_systemd_user_logs",
                "get_systemd_kernel_logs",
                "get_diagnostic_info"
            ])

    async def on_system_prompt(self):
        """Build a rich system info block for the AI's context."""
        lines = [f"OS: {OS} ({platform.release()})"]

        if OS == "linux":
            try:
                distro_info = platform.freedesktop_os_release()
                lines.append(f"Distro: {distro_info.get('PRETTY_NAME', distro_info.get('ID', 'unknown'))}")
            except:
                pass

            # cpu
            try:
                sh_lscpu = _sh("lscpu -J")
                cpu_info = json.loads(sh_lscpu)['lscpu']
                for entry in cpu_info:
                    if entry['field'].lower().startswith("model name"):
                        lines.append(f"CPU: {entry['data']}")
                        break
            except:
                pass

            # ram
            try:
                mem_out = _sh("free -m | grep Mem")
                if mem_out:
                    total = mem_out.split()[1]
                    lines.append(f"RAM: {total}MB total")
            except:
                pass

            # gpu
            try:
                for line in _sh("lspci").splitlines():
                    if "vga" in line.lower():
                        lines.append(f"GPU: {line.strip()}")
                        break
            except:
                pass

        elif OS == "darwin":
            lines.append(f"Mac: {platform.mac_ver()[0]}")
        elif OS == "windows":
            lines.append(f"Windows: {platform.win32_edition()}")

        lines.append(f"Arch: {platform.machine() or 'unknown'}")
        lines.append(f"Hostname: {platform.node()}")

        return "\n".join(lines) + "\n"

    # ============================
    # SYSTEM INFO TOOLS
    # ============================

    async def get_overview(self):
        data = {
            "os": OS,
            "os_release": platform.release(),
            "platform": platform.platform(),
            "architecture": platform.machine() or "unknown",
            "hostname": platform.node(),
            "home_dir": os.path.expanduser("~"),
        }

        if OS == "linux":
            try:
                sh_lscpu = _sh("lscpu -J")
                cpu_info = json.loads(sh_lscpu)['lscpu']
                data['cpu'] = "information not found"
                for entry in cpu_info:
                    if entry['field'].lower().startswith("model name"):
                        data['cpu'] = entry['data']
                        break
            except Exception as e:
                data['cpu'] = f"error: {e}"

            data['kernel'] = _sh("uname -a")

            data['gpus'] = []
            for line in _sh("lspci").splitlines():
                if "vga" in line.lower():
                    data['gpus'].append(line.strip())

            try:
                distro_info = {}
                for key, value in platform.freedesktop_os_release().items():
                    key = key.lower()
                    if key.endswith("name") or key.endswith("id") or key.startswith("version") or key.startswith("variant"):
                        distro_info[key] = value
                data['distro'] = distro_info
            except:
                pass
        elif OS == "darwin":
            data['mac_ver'] = platform.mac_ver()
        elif OS == "windows":
            data['win32_ver'] = platform.win32_ver()
            data['win32_edition'] = platform.win32_edition()

        return self.result(data)

    async def get_cpu_info(self):
        if OS == "linux":
            cpu_info_filtered = {}
            try:
                sh_lscpu = _sh("lscpu -J")
                cpu_info = json.loads(sh_lscpu)['lscpu']
                for entry in cpu_info:
                    key = entry['field']
                    if key.lower() in ("flags"):
                        continue
                    cpu_info_filtered[key] = entry['data']
            except Exception as e:
                return self.result(None, f"Couldn't fetch CPU info: {e}")
            data = cpu_info_filtered
        elif OS == "darwin":
            data = _sh("sysctl hw.model")
        elif OS == "windows":
            data = _sh("wmic cpu get name")

        return self.result(data)

    async def get_running_processes(self, limit: int = 10, show_system_processes: bool = False):
        try:
            import psutil
        except ImportError:
            return self.result("psutil not installed. Install with: pip install psutil", False)

        results = []
        for pid in psutil.pids():
            process = psutil.Process(pid)
            target_user = os.getlogin().lower() if not show_system_processes else "root"

            try:
                if process.username().lower() != target_user:
                    continue
            except:
                continue

            try:
                p_cpu = round(process.cpu_percent(), 2)
                p_mem = round(process.memory_percent(), 2)
                p_cmdline = process.cmdline()
                p_cmdline[0] = os.path.basename(p_cmdline[0])
                p_cmdline_short = len(p_cmdline) > 5
                p_cmd = " ".join(p_cmdline[:5]) + (".." if p_cmdline_short else "")

                results.append({
                    "cmd": p_cmd,
                    "pid": pid,
                    "cpu_usage": f"{p_cpu}%",
                    "mem_usage": f"{p_mem}%",
                })
            except Exception:
                pass

        results.sort(key=lambda x: float(x["mem_usage"].rstrip('%')), reverse=True)
        return self.result(results[:limit])

    async def get_memory_usage(self):
        data = {}
        if OS == "linux":
            if shutil.which("free"):
                data['cpu_mem'] = _sh("free -m")
            if shutil.which("nvtop"):
                data['gpu_mem'] = _sh("nvtop -s")
        return self.result(data)

    async def get_disk_usage(self):
        if OS in ("linux", "darwin"):
            return self.result(_sh("df -h"))
        elif OS == "windows":
            return self.result(_sh("wmic logicaldisk"))
        return self.result("Unsupported OS", False)

    async def get_home_dir_path(self):
        return self.result(os.path.expanduser("~"))

    async def get_env_vars(self):
        return self.result(dict(os.environ))

    async def get_linux_distro(self):
        if OS != "linux":
            return self.result("Not a Linux system", False)
        try:
            distro_info = platform.freedesktop_os_release()
            distro = distro_info['ID']
            related = distro_info.get('ID_LIKE', '').split(" ")
            return self.result({"distro": distro, "related": related})
        except Exception as e:
            return self.result(f"Error: {e}", False)

    async def get_diagnostic_info(self):
        if OS != "linux":
            return self.result("Linux only", False)

        return self.result({
            "mounts": _sh("mount"),
            "usb_devices": _sh("lsusb"),
            "kernel_modules": _sh("lsmod"),
            "lsirq": _sh("lsirq"),
            "lsipc": _sh("lsipc")
        })

    async def get_man_page(self, cmd: str):
        if OS not in ("linux", "darwin"):
            return self.result("Man pages not available on this OS", False)
        cmd = cmd.split(" ")[0]
        return self.result(_sh(f"man --pager '' {cmd}"))

    async def get_logged_in_users(self):
        if OS != "linux":
            return self.result("Linux only", False)
        return self.result(_sh("w"))

    # ============================
    # SYSTEM CONTROL TOOLS
    # ============================

    async def kill_process(self, pid: int = None, process_name: str = None):
        if OS == "linux":
            if pid:
                return self.result(_sh(f"kill -9 {pid}"))
            elif process_name:
                return self.result(_sh(f"killall -9 {process_name}"))
        elif OS == "windows":
            if pid:
                return self.result(_sh(f"taskkill /f /pid {pid}"))
            elif process_name:
                return self.result(_sh(f"taskkill /f /im {process_name}"))
        elif OS == "darwin":
            if pid:
                return self.result(_sh(f"kill -9 {pid}"))
            elif process_name:
                return self.result(_sh(f"pkill -f {process_name}"))

        return self.result("Unsupported OS", False)

    async def lock_screen(self):
        if OS == "linux":
            return self.result(_sh("loginctl lock-session"))
        elif OS == "windows":
            return self.result(_sh("rundll32.exe user32.dll,LockWorkStation"))
        elif OS == "darwin":
            return self.result(_sh('osascript -e \'tell application "System Events" to activate\''))
        return self.result("Unsupported OS", False)

    # ============================
    # PACKAGE MANAGEMENT
    # ============================

    async def get_installed_packages(self):
        if OS != "linux":
            return self.result("Linux only", False)

        result = {}

        if shutil.which("pacman"):
            result['pacman_packages'] = _sh("pacman -Qe")
        elif shutil.which("apt"):
            result['apt_packages'] = _sh("dpkg -l")
        elif shutil.which("rpm"):
            result['rpm_packages'] = _sh("rpm -qa")

        if shutil.which("flatpak"):
            result['flatpak_packages'] = _sh("flatpak list")

        if shutil.which("snap"):
            result['snap_packages'] = _sh("snap list")

        return self.result(result)

    async def search_linux_packages(self, query: str):
        if OS != "linux":
            return self.result("Linux only", False)

        result = {}

        if shutil.which("pacman"):
            result['pacman'] = _sh(f"pacman -Ss {query}")
        elif shutil.which("apt"):
            result['apt'] = _sh(f"apt-cache search {query}")
        elif shutil.which("rpm"):
            result['rpm'] = _sh(f"yum search {query}")

        if shutil.which("flatpak"):
            result['flatpak'] = _sh(f"flatpak search {query}")

        if shutil.which("snap"):
            result['snap'] = _sh(f"snap find {query}")

        return self.result(result)

    async def flatpak_install_package(self, name: str):
        if not self.config.get("allow_flatpak_install", default=False):
            return self.result("flatpak_install is disabled. Enable in module settings.", False)
        if not shutil.which("flatpak"):
            return self.result("Flatpak not installed", False)
        return self.result(_sh(f"flatpak install --noninteractive {name}"))

    async def flatpak_remove_package(self, name: str):
        if not self.config.get("allow_flatpak_remove", default=False):
            return self.result("flatpak_remove is disabled. Enable in module settings.", False)
        if not shutil.which("flatpak"):
            return self.result("Flatpak not installed", False)
        return self.result(_sh(f"flatpak uninstall --noninteractive {name}"))

    # ============================
    # SYSTEMD SERVICES
    # ============================

    async def list_user_services(self):
        if not shutil.which("systemctl"):
            return self.result("systemctl not available", False)
        return self.result(_sh("systemctl --user list-unit-files --type service"))

    async def list_system_services(self):
        if not shutil.which("systemctl"):
            return self.result("systemctl not available", False)
        return self.result(_sh("systemctl list-unit-files --type service"))

    async def get_system_service_status(self, name: str):
        return self.result({
            "status": _sh(f"systemctl status {name}"),
            "journal": _sh(f"journalctl -I -n 50 -u {name}")
        })

    async def get_user_service_status(self, name: str):
        return self.result({
            "status": _sh(f"systemctl --user status {name}"),
            "journal": _sh(f"journalctl --user -I -n 50 -u {name}")
        })

    async def start_user_service(self, name: str):
        if not self.config.get("allow_systemd_control", default=False):
            return self.result("systemd_control is disabled. Enable in module settings.", False)
        return self.result(_sh(f"systemctl --user -v start {name}"))

    async def restart_user_service(self, name: str):
        if not self.config.get("allow_systemd_control", default=False):
            return self.result("systemd_control is disabled. Enable in module settings.", False)
        return self.result(_sh(f"systemctl --user -v restart {name}"))

    async def stop_user_service(self, name: str):
        if not self.config.get("allow_systemd_control", default=False):
            return self.result("systemd_control is disabled. Enable in module settings.", False)
        return self.result(_sh(f"systemctl --user -v stop {name}"))

    async def kill_user_service(self, name: str):
        if not self.config.get("allow_systemd_control", default=False):
            return self.result("systemd_control is disabled. Enable in module settings.", False)
        return self.result(_sh(f"systemctl --user kill {name}"))

    async def get_systemd_user_logs(self):
        return self.result(_sh("journalctl --user -b -n1000"))

    async def get_systemd_kernel_logs(self):
        return self.result(_sh("journalctl -k"))

    # ============================
    # NETWORK CONTROL
    # ============================

    async def turn_network_off(self):
        if not self.config.get("allow_network_control", default=False):
            return self.result("network_control is disabled. Enable in module settings.", False)
        if OS != "linux" or not shutil.which("nmcli"):
            return self.result("Linux only (requires nmcli)", False)
        return self.result(_sh("nmcli network off"))

    async def turn_network_on(self):
        if not self.config.get("allow_network_control", default=False):
            return self.result("network_control is disabled. Enable in module settings.", False)
        if OS != "linux" or not shutil.which("nmcli"):
            return self.result("Linux only (requires nmcli)", False)
        return self.result(_sh("nmcli network on"))

    # ============================
    # MEDIA CONTROL
    # ============================

    async def get_media_currently_playing(self):
        if not shutil.which("playerctl"):
            return self.result("playerctl not installed", False)
        return self.result(_sh("playerctl metadata"))

    async def toggle_media_pause(self):
        if not shutil.which("playerctl"):
            return self.result("playerctl not installed", False)
        return self.result(_sh("playerctl play-pause"))

    async def media_next(self):
        if not shutil.which("playerctl"):
            return self.result("playerctl not installed", False)
        return self.result(_sh("playerctl next"))

    async def media_previous(self):
        if not shutil.which("playerctl"):
            return self.result("playerctl not installed", False)
        return self.result(_sh("playerctl previous"))

    async def toggle_media_shuffle(self):
        if not shutil.which("playerctl"):
            return self.result("playerctl not installed", False)
        return self.result(_sh("playerctl shuffle Toggle"))

    async def media_stop(self):
        if not shutil.which("playerctl"):
            return self.result("playerctl not installed", False)
        return self.result(_sh("playerctl stop"))
