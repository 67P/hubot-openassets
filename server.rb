require 'openassets'
require 'sinatra'

$api = OpenAssets::Api.new({:network => 'testnet',
                     :provider => 'bitcoind',
                     :dust_limit => 600,
                     :rpc => {:user => ENV['RPC_USER'], :password => ENV['RPC_PASSWORD'], :schema => 'http', :port => ENV['RPC_PORT'], :host => ENV['RPC_HOST']}})

if ENV['AUTH_USERNAME']
  use Rack::Auth::Basic, "Restricted Area" do |username, password|
    username == ENV['AUTH_USERNAME'] and password == ENV['AUTH_PASSWORD']
  end
end

get '/list_unspent' do
  $api.list_unspent
end

get '/get_balance' do
  $api.get_balance(params[:asset])
end

post 'send_asset' do
  $api.send_asset(params[:from], params[:asset_id], params[:amount], params[:to], 10000, 'broadcast')
end

