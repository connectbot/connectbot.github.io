require 'html/proofer'

task :default => :build

desc 'Clean up site output'
task :clean do
  cleanup
end

desc 'Build site with Jekyll'
task :build => :clean do
  jekyll('build')
end

desc 'Check site with html-proofer'
task :test => :build do
  HTML::Proofer.new("./_site").run
end

desc 'Start Jekyll server with --watch'
task :server => :clean do
  jekyll('serve --watch')
end

def cleanup
  sh 'rm -rf _site'
end

def jekyll(opts = '')
  sh 'bundle exec jekyll ' + opts
end
