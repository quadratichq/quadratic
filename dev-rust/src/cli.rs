use clap::Parser;

#[derive(Parser, Debug, Clone)]
#[command(name = "dev-rust")]
#[command(about = "Rust-based dev server for Quadratic")]
pub struct Cli {
    /// Port for the web server
    #[arg(short, long, default_value_t = 8080)]
    pub port: u16,

    /// Watch client by default
    #[arg(short = 'r', long, default_value_t = true)]
    pub client: bool,

    /// Watch API (default: true)
    #[arg(short = 'a', long, default_value_t = true)]
    pub api: bool,

    /// Watch core (default: true)
    #[arg(short = 'c', long, default_value_t = true)]
    pub core: bool,

    /// Watch multiplayer (default: true)
    #[arg(short = 'm', long, default_value_t = true)]
    pub multiplayer: bool,

    /// Watch files (default: true)
    #[arg(short = 'f', long, default_value_t = true)]
    pub files: bool,

    /// Watch connection (default: true)
    #[arg(short = 'n', long, default_value_t = true)]
    pub connection: bool,

    /// Watch python (default: true)
    #[arg(short = 'y', long, default_value_t = true)]
    pub python: bool,

    /// Watch shared (default: true)
    #[arg(short = 's', long, default_value_t = true)]
    pub shared: bool,

    /// Watch all services
    #[arg(short = 'l', long)]
    pub all: bool,

    /// Skip types compilation
    #[arg(short = 't', long)]
    pub skip_types: bool,

    /// Run without Rust compilation
    #[arg(short = 'u', long)]
    pub no_rust: bool,
}
