export function generateZshIntegration(): string {
  return `# crayfish-farm zsh integration
# Add this to your ~/.zshrc

# Wrapper function for eval-based cd
crayfish_farm() {
  local result
  result=$(crayfish-farm go "$@" 2>/dev/null)
  if [ $? -eq 0 ] && [ -n "$result" ]; then
    eval "$result"
  fi
}

# Right prompt showing crayfish-farm status
crayfish_farm_rprompt() {
  crayfish-farm prompt-status 2>/dev/null
}

# Set RPROMPT to show crayfish status
RPROMPT='$(crayfish_farm_rprompt)'

# Optional: auto-start daemon in background
# crayfish-farm daemon start --quiet &>/dev/null &
`;
}

export function generateBashIntegration(): string {
  return `# crayfish-farm bash integration
# Add this to your ~/.bashrc

# Wrapper function for eval-based cd
crayfish_farm() {
  local result
  result=$(crayfish-farm go "$@" 2>/dev/null)
  if [ $? -eq 0 ] && [ -n "$result" ]; then
    eval "$result"
  fi
}

# PS1 function showing crayfish-farm status
crayfish_ps1() {
  crayfish-farm prompt-status 2>/dev/null
}

# Append crayfish status to PS1
PS1="\\$(crayfish_ps1)\${PS1}"

# Optional: auto-start daemon in background
# crayfish-farm daemon start --quiet &>/dev/null &
`;
}

export function generateTmuxIntegration(): string {
  return `# crayfish-farm tmux integration
# Add this to your ~/.tmux.conf

set -g status-right "#(crayfish-farm tmux-status) | %H:%M"
set -g status-interval 2
`;
}
