{
  description = "A Nix-flake-based Rust development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      rust-overlay,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
          overlays = [ rust-overlay.overlays.default ];
        };
        rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
      in
      {
        # packages.default = pkgs.callPackage ./. {};
        devShells.default = pkgs.mkShell {
          shellHook = ''
            export

          '';
          packages = with pkgs; [
            nginx-language-server
            nginx-config-formatter

            caddyfile-language-server

            pgformatter
            postgres-lsp
            postgresql
            rustToolchain
            openssl
            openssl_3
            pkg-config
            cargo-deny
            cargo-edit
            cargo-watch
            rust-analyzer
            clang
            docker
            docker-compose
            mold

            docker-compose-language-service
            dockerfile-language-server-nodejs
            docker-language-server
            docker-buildx
            # ffmpeg
            rustPlatform.bindgenHook
            llvmPackages.libclang
          ];

          env = {
            LD_LIBRARY_PATH = "${pkgs.openssl.out}/lib";
            OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";
            PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig";
            RUSTFLAGS = "-C linker=clang -C link-arg=-fuse-ld=mold";
            LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}";
            # BINDGEN_EXTRA_CLANG_ARGS = "-isystem ${pkgs.llvmPackages.libclang.lib}/lib/clang/${pkgs.lib.getVersion pkgs.clang}/include";
            RUST_SRC_PATH = "${rustToolchain}/lib/rustlib/src/rust/library";
          };
        };
      }
    );
}
