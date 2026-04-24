{ config, pkgs, ... }: {
  imports = [
    ./nixos/auto-upgrade.nix
    ./nixos/home-manager.nix
    ./nixos/network-manager.nix
    ./nixos/nix.nix
    ./nixos/systemd-boot.nix
    ./nixos/timezone.nix
    ./nixos/users.nix
    ./nixos/utils.nix
    ./nixos/ssh.nix
    ./nixos/variables-config.nix
    ./hardware-configuration.nix
    ./nixos/docker.nix
    ./variables.nix
  ];

  # networking.firewall = {
  #   enable = true;
  #   allowedTCPPorts = [ 5432 8080 ];
  # };

  # systemd.services."docker-compose-myapp" = {
  #   description = "Planbackend";
  #   after = [ "docker.service" ];
  #   wantedBy = [ "multi-user.target" ];
  
  #   serviceConfig = {
  #     Type = "oneshot";
  #     RemainAfterExit = true;
  #     WorkingDirectory = "/home/planuser/planbackend";
  #     ExecStart = "${pkgs.docker-compose}/bin/docker-compose up -d";
  #     ExecStop = "${pkgs.docker-compose}/bin/docker-compose down";
  #   };
  
  #   path = [ pkgs.docker-compose ];
  # };
  home-manager.users."${config.var.username}" = import ./home.nix;
  home-manager.backupFileExtension = "backup";
  # Don't touch this
  system.stateVersion = "25.05";
}
