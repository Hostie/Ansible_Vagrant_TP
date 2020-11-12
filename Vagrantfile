Vagrant.configure("2") do |config|
  config.vm.box = "debian/buster64"
  config.vm.provider "virtualbox" do |vb|
    vb.name = "ansible_tp"
    vb.cpus = 2
    vb.memory = 2048
  end
  config.vm.network :forwarded_port, guest: 3000, host: 3000
  config.vm.provision "ansible_local" do |ansible|
  ansible.playbook = "playbook.yml"
  ansible.install_mode = "pip"
  ansible.version = "latest"
  end
end
