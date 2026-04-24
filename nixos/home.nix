{ pkgs, config, inputs, ... }: {

  imports = [
    ./variables.nix

  ];



  home = {
    inherit (config.var) username;
    homeDirectory = "/home/" + config.var.username;
    # Import my profile picture, used by the hyprpanel dashboard
    packages = with pkgs; [
      helix
      git
      curl
      vim
    ];
    # Don't touch this
    stateVersion = "25.05";
  };

  programs.home-manager.enable = true;
}
