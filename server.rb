require 'openassets'
require 'sinatra'
require 'dotenv'
Dotenv.load

$api = OpenAssets::Api.new({:network => ENV['BITCOIN_NETWORK'],
                     :provider => 'bitcoind',
                     :dust_limit => 6000,
                     :rpc => {:user => ENV['RPC_USER'], :password => ENV['RPC_PASSWORD'], :schema => ENV['RPC_SCHEMA'], :port => ENV['RPC_PORT'], :host => ENV['RPC_HOST']}})

if ENV['AUTH_USERNAME']
  use Rack::Auth::Basic, "Restricted Area" do |username, password|
    username == ENV['AUTH_USERNAME'] and password == ENV['AUTH_PASSWORD']
  end
end

get '/list_unspent' do
  JSON.dump $api.list_unspent
end

get '/get_balance' do
  JSON.dump $api.get_balance(params[:asset])
end

post '/send_asset' do
  JSON.dump $api.send_asset(params[:from], params[:asset_id], params[:amount].to_i, params[:to], 10000, 'broadcast')
end

