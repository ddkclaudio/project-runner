pub mod activity_log;
pub mod assets;
pub mod cli;
pub mod commands;
pub mod deepseek;
pub mod github;
pub mod install;
pub mod launch;
pub mod launchfile;
pub mod runners;
pub mod runtime;
pub mod self_update;
pub mod store;
pub mod version;

pub use cli::{cli_requested, run_cli};
