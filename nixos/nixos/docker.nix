{ pkgs, config, ... }:
{
  boot.kernel.sysctl."net.ipv4.ip_unprivileged_port_start" = 80; # allow docker to use 80

  environment.defaultPackages = with pkgs; [ docker docker-compose ];
  virtualisation.docker = {
    enable = true;

    rootless = {
      enable = true;
      setSocketVariable = true;
    };
  };
  users.users."${config.var.username}".extraGroups = [ "docker" ];
}
