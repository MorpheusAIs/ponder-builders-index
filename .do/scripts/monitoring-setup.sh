#!/bin/bash

# User Data Script for DigitalOcean Monitoring Droplet
# This script automatically sets up Prometheus and Grafana on a fresh Ubuntu droplet

set -e

# Update system
apt-get update -y
apt-get upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create monitoring user
useradd -m -s /bin/bash monitoring
usermod -aG docker monitoring

# Create monitoring directory structure
mkdir -p /opt/monitoring/{prometheus,grafana,alertmanager,postgres-exporter}
cd /opt/monitoring

# Download monitoring configuration from repository
git clone https://github.com/MorpheusAIs/ponder-builders-index.git temp-repo
mv temp-repo/.do/monitoring/* .
rm -rf temp-repo

# Set proper permissions
chown -R monitoring:monitoring /opt/monitoring
chmod +x scripts/*.sh

# Create environment file
cat > .env << EOF
# Monitoring Configuration
GRAFANA_ADMIN_PASSWORD=ponder_monitor_2024
POSTGRES_PASSWORD=your_postgres_password
DATABASE_HOST=your_database_host

# Email settings for alerts (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EOF

# Set up systemd service for monitoring stack
cat > /etc/systemd/system/ponder-monitoring.service << EOF
[Unit]
Description=Ponder Monitoring Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/monitoring
ExecStart=/usr/local/bin/docker-compose -f docker-compose.monitoring.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.monitoring.yml down
User=monitoring
Group=monitoring

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl enable ponder-monitoring.service
systemctl start ponder-monitoring.service

# Set up log rotation
cat > /etc/logrotate.d/ponder-monitoring << EOF
/opt/monitoring/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

# Install monitoring tools
apt-get install -y htop nethogs iotop ncdu

# Set up firewall
ufw allow 22/tcp      # SSH
ufw allow 3001/tcp    # Grafana
ufw allow 9090/tcp    # Prometheus
ufw allow 9093/tcp    # Alertmanager
ufw --force enable

# Create monitoring startup script
cat > /opt/monitoring/start-monitoring.sh << 'EOF'
#!/bin/bash
cd /opt/monitoring
docker-compose -f docker-compose.monitoring.yml up -d
docker-compose -f docker-compose.postgres-exporter.yml up -d

echo "Monitoring stack started!"
echo "Grafana: http://$(curl -s ifconfig.me):3001 (admin / ponder_monitor_2024)"
echo "Prometheus: http://$(curl -s ifconfig.me):9090"
echo "Alertmanager: http://$(curl -s ifconfig.me):9093"
EOF

chmod +x /opt/monitoring/start-monitoring.sh

# Create status check script
cat > /opt/monitoring/check-status.sh << 'EOF'
#!/bin/bash
cd /opt/monitoring

echo "=== Monitoring Stack Status ==="
docker-compose -f docker-compose.monitoring.yml ps
echo ""

echo "=== Container Health ==="
for container in ponder_prometheus ponder_grafana ponder_node_exporter ponder_cadvisor; do
    if docker ps --filter "name=$container" --filter "status=running" -q | head -n1 | grep -q .; then
        echo "✓ $container is running"
    else
        echo "✗ $container is not running"
    fi
done
echo ""

echo "=== Service URLs ==="
PUBLIC_IP=$(curl -s ifconfig.me)
echo "Grafana: http://$PUBLIC_IP:3001"
echo "Prometheus: http://$PUBLIC_IP:9090"
echo "Alertmanager: http://$PUBLIC_IP:9093"
echo ""

echo "=== System Resources ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2 $3}'
echo "Memory Usage:"
free -h | awk 'NR==2{printf "%.2f%% (%s/%s)\n", $3*100/$2, $3, $2}'
echo "Disk Usage:"
df -h / | awk 'NR==2{print $5 " used"}'
EOF

chmod +x /opt/monitoring/check-status.sh

# Set up cron job for health checks
(crontab -u monitoring -l 2>/dev/null; echo "*/5 * * * * /opt/monitoring/check-status.sh >> /opt/monitoring/logs/health-check.log 2>&1") | crontab -u monitoring -

# Create log directory
mkdir -p /opt/monitoring/logs
chown monitoring:monitoring /opt/monitoring/logs

# Start the monitoring stack
su - monitoring -c "cd /opt/monitoring && /usr/local/bin/docker-compose -f docker-compose.monitoring.yml up -d"

# Wait for services to start
sleep 30

# Get public IP for final message
PUBLIC_IP=$(curl -s ifconfig.me)

# Create welcome message
cat > /opt/monitoring/README.md << EOF
# Ponder Monitoring Stack

This droplet is running a complete monitoring stack for your Ponder deployment.

## Access URLs

- **Grafana Dashboard**: http://$PUBLIC_IP:3001
  - Username: admin
  - Password: ponder_monitor_2024

- **Prometheus**: http://$PUBLIC_IP:9090
- **Alertmanager**: http://$PUBLIC_IP:9093

## Management Commands

- Start monitoring: \`/opt/monitoring/start-monitoring.sh\`
- Check status: \`/opt/monitoring/check-status.sh\`
- View logs: \`cd /opt/monitoring && docker-compose logs -f\`
- Restart services: \`cd /opt/monitoring && docker-compose restart\`

## Configuration Files

- Prometheus config: \`/opt/monitoring/prometheus/prometheus.yml\`
- Grafana dashboards: \`/opt/monitoring/grafana/dashboards/\`
- Alert rules: \`/opt/monitoring/prometheus/rules/\`

## Next Steps

1. Configure your Ponder apps to be reachable from this monitoring server
2. Update Prometheus targets in prometheus.yml with your actual app URLs
3. Set up email/Slack alerts in alertmanager.yml
4. Import additional dashboards from https://grafana.com/dashboards
5. Set up SSL certificates for HTTPS access

## Troubleshooting

- Check service status: \`systemctl status ponder-monitoring\`
- View system logs: \`journalctl -u ponder-monitoring -f\`
- Container logs: \`cd /opt/monitoring && docker-compose logs\`

EOF

# Log completion
echo "Monitoring droplet setup completed at $(date)" >> /var/log/monitoring-setup.log
echo "Public IP: $PUBLIC_IP" >> /var/log/monitoring-setup.log

# Final status message
echo "Setup complete! Monitoring stack is available at http://$PUBLIC_IP:3001"



