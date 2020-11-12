# levraud_dylan_TP3
Rendu TP3 - Dylan Levraud B3A



# Avant-propos

Ce TP fait suite au TP Vagrant. Cette documentation ne présentera pas l'installation de la vm. Je vous renvoie à ce [lien](https://github.com/YnovB3DevOps20192020/levraud_dylan_TP2)

# Objectif du TP 

Rendre accessible une API NodeJS simple avec une route :  

  - `GET /` contenant le message suivant :
```nodejs
  { "message": "Hello World" }
```

L'API sera hébergé derrière un serveur NGINX.  
NGINX sera le point d'entrée de l'applicatif et configuré en `proxy_pass` vers l'applicatif NodeJS.  
L'applicatif NodeJS fonctionnera soit via le gestionnaire de processus `pm2` soit via une unité `systemD`  
L'API devra répondre via l'URL `http://localhost:3000/api`  

# Vagrantfile 

Pour ce TP nous allons reprendre la VM crée dans le TP 2 

Le Vagrantfile prend cette forme : 

```
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

```

Ici nous avons besoin d'un port-forwarding au port 3000 pour call notre API : 

``` config.vm.network :forwarded_port, guest: 3000, host: 3000 ```

Nous avons également besoin d'installer **Ansible** qui permettra la configuration de notre VM.

```
config.vm.provision "ansible_local" do |ansible|
  ansible.playbook = "playbook.yml"
  ansible.install_mode = "pip"
  ansible.version = "latest"
```

Le playbook.yml est un fichier YAML qui va permettre l'execution des tâches que nous souhaitons effectuer sur notre vm. Il est intéressant de comprendre que ce fichier est réplicable à l'infini et permet de gagner un temps précieux dans les installations. Il suffira de modifier ce playbook pour changer notre configuration. 

Pip est le gestionnaire des paquets écrits en python. 

# Api NODEJS

Le dossier possède une api toute simple qui stocke à l'adresse http://localhost:3000/api

``` { "message": "Hello World" }```

# hello_world.service

Le fichier hello_world.service va nous permettre de lancer notre api au port 3000 sous la forme d'un service 

Il prend la forme suivante : 

```
[Unit]
Description=server.js  
Documentation=https://example.com
After=network.targetx

[Service]
Environment=NODE_PORT=3000
Type=simple
User=vagrant
ExecStart=/usr/bin/node /vagrant/api/nodeapi/simple-node-api/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
# Reverse Proxy

le fichier proxypass.conf va permettre de créer un reverse proxy pour pouvoir contacter notre api via un appel au serveur Ngninx. 

```
server {
          listen 80;
          location / {
              proxy_pass http://localhost:3000/api;
              proxy_set_header Authorization "";
              proxy_read_timeout 90s;
          }
    } 
```

# Configuration ANSIBLE (avec playbook scindé en roles)

## playbook.yml

Ce fichier va permettre d'appeler les différents rôles qui vont nous permettre la configuration de notre vm

```
---
- name: main
  hosts: all
  become : True
  become_method: sudo
  tasks:
    - name: Include nginx
      include_role:
        name: nginx
    - name: Include nodejs
      include_role:
        name: nodejs
    - name: Include systemconfiguration
      include_role:
        name: systemconfig
```

Ici le fichier a tâches d'appels des rôles Nginx, NodeJs, et SystemConfig. Chaque rôle contient un certain nombre de tâches dans le dossier tasks. Les handlers vont permettre d'assurer une idempotence en ne modifiant pas les fichiers quand ceci n'est pas nécéssaire. 

```
roles/
├── nginx
│   ├── defaults
│   ├── files
│   ├── handlers
│   │   └── main.yml
│   ├── library
│   ├── meta
│   ├── tasks
│   │   ├── main.yml
│   │   ├── nginx_config.yml
│   │   └── nginx_install.yml
│   ├── templates
│   └── vars
├── nodejs
│   ├── defaults
│   ├── files
│   ├── handlers
│   ├── library
│   ├── meta
│   ├── tasks
│   │   ├── main.yml
│   │   └── node_install.yml
│   ├── templates
│   └── vars
└── systemconfig
    ├── defaults
    ├── files
    ├── handlers
    │   └── main.yml
    ├── library
    ├── meta
    ├── tasks
    │   ├── hello_service.yml
    │   └── main.yml
    ├── templates
    └── vars
```
### Le rôle NGINX

Le rôle Nginx se décompose ainsi 

```
├── defaults
├── files
├── handlers
│   └── main.yml
├── library
├── meta
├── tasks
│   ├── main.yml
│   ├── nginx_config.yml
│   └── nginx_install.yml
├── templates
└── vars
```

Le fichier tasks/main.yml appelle le fichier d'installation et le fichier de configuration :

```
---
- name: include install
  include : nginx_install.yml
  

- name: include config
  include: nginx_config.yml

```

Le fichier tasks/nginx_install.yml contient un module apt pour installer nginx

```
---
- name: install NGINX 
  become: yes
  apt:
    name: nginx
    state: present
    
```

Le fichier tasks/nginx_config.yml va appeler différents modules pour supprimer le virtual host par défaut, pour copier le proxypass.conf pour le le placer au bon chemin et de créer un lien pour le proxy

```
---
- name: trash default virtual host
  become: yes
  file:
    path: etc/nginx/sites-enabled/default
    state: absent
  notify: 
    - nginx reload

- name: nginx conf file
  become: yes
  copy:
    src: /vagrant/proxypass.conf
    dest: /etc/nginx/sites-available/proxypass.conf
  notify: 
    - nginx reload


- name: Link NGINX Reverse Proxy
  become: yes
  file:
    src: /etc/nginx/sites-available/proxypass.conf 
    dest: /etc/nginx/sites-enabled/proxypass.conf
    state: link 
  notify: 
    - nginx reload
```


Le fichier handlers/main.yml va permettre de reload nginx seulement si il y a un changement :
*

```
---
- name: nginx reload
  become: True 
  service:
    name: nginx
    state: restarted

```


### Le rôle NODEJS

Le rôle NodeJs se décompose ainsi :

```
├── defaults
├── files
├── handlers
├── library
├── meta
├── tasks
│   ├── main.yml
│   └── node_install.yml
├── templates
└── vars
```
Le fichier tasks/main.yml appelle le fichier d'installation, nous aurions pu tout réunir dans ce fichier main.yml mais celui nous permettra une meilleure evolutivité du code. 

```
---
- name: include install node
  include : node_install.yml

```

Le fichier tasks/node_install.yml appelle des modules apt pour l'installation de nodejs ainsi que de npm. Puis lance une command npm qui va permettre d'installer le package express pour lancer notre serveur. 

```
---
- name: install nodejs
  apt: 
    name: nodejs
    update_cache: yes

- name : install npm
  apt:
    name: npm
    update_cache: yes

- name: Install packages based on package.json.
  npm:
    path: /vagrant/api/nodeapi/simple-node-api/    

```


### Le rôle SytemConfig

Le rôle SystemConfig se décompose ainsi :


```
├── defaults
├── files
├── handlers
│   └── main.yml
├── library
├── meta
├── tasks
│   ├── hello_service.yml
│   └── main.yml
├── templates
└── vars
```

Le fichier tasks/main.yml appelle le fichier hello_service.yml , encore nous aurions pu tout réunir dans ce fichier main.yml mais celui nous permettra une meilleure evolutivité du code. 

```
---
- name: include install systemconfig
  include : hello_service.yml

```

Le fichier tasks/hello_service.yml va permettre de copier notre fichier hello_world.service et le placer dans systemd et de declencher notre handler au besoin. Le fichier permet également de run notre service. 

```
---
- name : cp file service
  become: yes
  copy:
    src: /vagrant/hello_world.service
    dest: /lib/systemd/system/hello_world.service
  notify:
    - systemctl restarted
      
- name: systemctl run
  systemd:
    state: started
    name: hello_world

```
Le fichier handlers/main.yml permet de restart systemctl au besoin. 

```
---
- name: systemctl restarted
  systemd:
    state: restarted
    daemon_reload: yes
```

# Vérification consigne 

Nous démarrons notre machine 

```
vagrant up`
```
Si vous avez besoin de reload

```
vagrant reload --provision
```

Pour vérifier si notre route fonctionne comme il faut : 

```curl http://localhost:3000/api```

Resultat :

```{"message":"Hello world"}```
